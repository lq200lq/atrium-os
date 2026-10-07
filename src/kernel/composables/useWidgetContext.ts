import { computed, inject, provide, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import {
  useWidgetRegistry,
  type RegisteredWidget,
  type WidgetPadding,
  type WidgetSize,
} from '../stores/widgetRegistry'
import {
  sanitizeConfig,
  useWidgets,
  type WidgetConfigValues,
  type WidgetInstance,
} from '../stores/widgets'
import { useWidgetRuntime } from '../stores/widgetRuntime'

/**
 * 预览沙箱标记（§4.8 三道屏蔽的入口）：容器 provide 一份样例载荷后，
 * 件内的数据 / 写 / 调度三条通道在沙箱里一律不走真实实现（台账 C-① 的护栏）。
 */
export interface WidgetPreviewContext {
  /** 与 manifest.data 键对齐的样例载荷（src/widgets/<id>/preview.json） */
  sample?: Record<string, unknown>
}

export const WIDGET_PREVIEW_KEY: InjectionKey<WidgetPreviewContext> = Symbol('widgetPreviewContext')

export interface WidgetContext {
  instanceId: string
  /** kind id：实例被摘掉后仍可读，件侧取数键与命名都靠它（比 instance?.kindId 少一层判空） */
  kindId: ComputedRef<string>
  /** 实例可能已被摘掉（确认移除后还有一帧在跑），件侧按可空读 */
  instance: ComputedRef<WidgetInstance | null>
  /** 注册表原物：除契约字段还带宿主用的异步组件，容器据此渲染、件侧不认识它 */
  manifest: ComputedRef<RegisteredWidget | null>
  /** 已按 manifest.config 收敛过的配置（键必属于 schema） */
  config: ComputedRef<WidgetConfigValues>
  size: ComputedRef<WidgetSize>
  /** 卡片内边距档（H-7）：件按它选 p-md / p-sm，材质仍归宿主 */
  padding: ComputedRef<WidgetPadding>
  /** 件内当前选中项（月历的日期、待办的筛选）——宿主据此构造下钻 payload（U7） */
  selected: ComputedRef<unknown>
  setSelected(value: unknown): void
  /** 当前是否在预览沙箱里渲染 */
  preview: boolean
  /** 该实例当前是否真的显示在桌面上（被溢出/停用时件可以少干活） */
  visible: ComputedRef<boolean>
}

/**
 * 上下文本体由容器建好再 provide（§4.8 预览沙箱的前提）：少了这一层，「无真实实例也能渲染」
 * 就得让件自己去查 store，沙箱只能往实例表里塞假数据——把管理面的脏东西引进桌面。
 */
export const WIDGET_CONTEXT_KEY: InjectionKey<WidgetContext> = Symbol('widgetContext')

/**
 * 小组件渲染契约：与 useWindowContext 同构——组件不接收 props，只认宿主给的上下文。
 * 尺寸档是宿主已知的离散值，因此不经容器查询反推，直接由这里给出。
 */
export function useWidgetContext(): WidgetContext {
  const ctx = inject(WIDGET_CONTEXT_KEY, null)
  if (!ctx) throw new Error('useWidgetContext 必须在小组件容器内使用')
  return ctx
}

/** 容器侧唯一出口 */
export function provideWidgetContext(ctx: WidgetContext): WidgetContext {
  provide(WIDGET_CONTEXT_KEY, ctx)
  return ctx
}

/** 真实实例的上下文：WidgetFrame 建一次，件内各通道拿到的是同一份对象 */
export function createWidgetContext(instanceId: string): WidgetContext {
  const store = useWidgets()
  const runtime = useWidgetRuntime()
  const registry = useWidgetRegistry()
  const instance = computed(() => store.byId(instanceId) ?? null)
  const kindId = computed(() => instance.value?.kindId ?? '')
  const manifest = computed(() => registry.byId(kindId.value) ?? null)
  return {
    instanceId,
    kindId,
    instance,
    manifest,
    config: computed(() => instance.value?.config ?? {}),
    size: computed(() => instance.value?.size ?? manifest.value?.widget.defaultSize ?? 'sm'),
    padding: computed(() => manifest.value?.padding ?? 'default'),
    selected: computed(() => store.selected[instanceId]),
    setSelected: (value: unknown) => store.setSelected(instanceId, value),
    preview: Boolean(inject(WIDGET_PREVIEW_KEY, null)),
    visible: computed(() => runtime.placementOf(instanceId).visible),
  }
}

/**
 * 预览沙箱的 mock 上下文：不进实例表、不查 store，配置喂 schema 默认值，
 * `setSelected` 为空操作——沙箱改不到任何真实状态。
 */
export function createPreviewWidgetContext(kindId: string, size: Ref<WidgetSize>): WidgetContext {
  const registry = useWidgetRegistry()
  const manifest = computed<RegisteredWidget | null>(() => registry.byId(kindId) ?? null)
  const previewId = `preview:${kindId}`
  const instance = computed<WidgetInstance | null>(() => ({
    id: previewId,
    kindId,
    size: size.value,
    pos: null,
    config: sanitizeConfig(undefined, manifest.value),
    addedAt: 0,
  }))
  return {
    instanceId: previewId,
    kindId: computed(() => kindId),
    instance,
    manifest,
    config: computed(() => instance.value?.config ?? {}),
    size: computed(() => size.value),
    padding: computed(() => manifest.value?.padding ?? 'default'),
    selected: computed(() => undefined),
    setSelected: () => {},
    preview: true,
    visible: computed(() => true),
  }
}
