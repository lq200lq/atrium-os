import { computed, inject, provide, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import { useWidgetRegistry, type WidgetConfigField } from '../stores/widgetRegistry'
import { useWidgets, type WidgetConfigValues } from '../stores/widgets'

/**
 * 配置面通道（§4.12）：**草稿/提交**这一层归宿主，面板只负责表达。
 * 宿主容器（`WidgetConfigPanel`）调 `provideWidgetConfigPanel()` 建通道；
 * 缺省的 schema 渲染器与件自绘的 `configEntry` 面板都调 `useWidgetConfigPanel()` 消费同一份通道，
 * 因此 `patch` 永远只改草稿，只有 `commit` 才过 `sanitizeConfig` 落库。
 */
export interface WidgetConfigPanelApi {
  instanceId: string
  kindId: string
  /** 写边界：schema 恒必填，面板能改的键只来自它 */
  schema: ComputedRef<WidgetConfigField[]>
  /** 草稿值（未提交） */
  values: Ref<WidgetConfigValues>
  dirty: ComputedRef<boolean>
  /** idle = 与线上值一致；dirty = 有未提交改动；saved = 刚提交过一次 */
  status: ComputedRef<'idle' | 'dirty' | 'saved'>
  patch(partial: Partial<WidgetConfigValues>): void
  setValue(key: string, value: string | number | boolean | undefined): void
  commit(): void
  reset(): void
  close(): void
}

export const WIDGET_CONFIG_PANEL_KEY: InjectionKey<WidgetConfigPanelApi> =
  Symbol('widgetConfigPanel')

/** 字段缺省值：`default` 缺位时按类型给一个安全值，避免草稿里出现 undefined */
export function fieldDefault(field: WidgetConfigField): string | number | boolean {
  const d = field.default
  if (typeof d === 'string' || typeof d === 'number' || typeof d === 'boolean') return d
  if (field.type === 'number') return typeof field.min === 'number' ? field.min : 0
  if (field.type === 'boolean') return false
  const first = field.options?.[0]
  return typeof first === 'string' ? first : (first?.value ?? '')
}

export function draftFromSchema(
  schema: WidgetConfigField[],
  current?: WidgetConfigValues,
): WidgetConfigValues {
  const draft: WidgetConfigValues = {}
  for (const field of schema) {
    const value = current?.[field.key]
    draft[field.key] =
      value === undefined || value === null ? fieldDefault(field) : (value as string | number)
  }
  return draft
}

/** 由宿主容器调用：建草稿、给提交口，并把关闭动作交回容器 */
export function provideWidgetConfigPanel(
  instanceId: string,
  onClose: () => void,
): WidgetConfigPanelApi {
  const store = useWidgets()
  const registry = useWidgetRegistry()
  const instance = computed(() => store.byId(instanceId))
  const kindId = computed(() => instance.value?.kindId ?? '')
  const schema = computed(() => registry.byId(kindId.value)?.config ?? ([] as WidgetConfigField[]))
  const values = ref<WidgetConfigValues>(draftFromSchema(schema.value, instance.value?.config))
  const savedAt = ref(0)

  const dirty = computed(() => {
    const current = instance.value?.config ?? {}
    return schema.value.some((f) => current[f.key] !== values.value[f.key])
  })

  const api: WidgetConfigPanelApi = {
    instanceId,
    kindId: kindId.value,
    schema,
    values,
    dirty,
    status: computed(() => (dirty.value ? 'dirty' : savedAt.value ? 'saved' : 'idle')),
    patch(partial) {
      Object.assign(values.value, partial)
      savedAt.value = 0
    },
    setValue(key, value) {
      if (value === undefined) return
      api.patch({ [key]: value })
    },
    commit() {
      store.updateConfig(instanceId, { ...values.value })
      savedAt.value = Date.now()
    },
    reset() {
      values.value = draftFromSchema(schema.value)
      savedAt.value = 0
    },
    close() {
      if (dirty.value) api.commit()
      onClose()
    },
  }
  // 通道建好就必须交进组件树：缺省渲染器靠 props 拿，件自绘的 configEntry 只认 inject——
  // 少这一步时 configEntry 一律抛「必须在配置面板容器内使用」，异步组件把错误吞成一张空面板
  provide(WIDGET_CONFIG_PANEL_KEY, api)
  return api
}

/**
 * 面板侧入口（件自绘 `configEntry` 也走这里）。
 * 台账 C-⑤ 的护栏在这里落地：面板**不碰 store**，只拿通道——所以它拿不到
 * `setSize` / `remove` / `setEnabled` 这类平台动作，配置面不会被养成第二个管理面。
 */
export function useWidgetConfigPanel(): WidgetConfigPanelApi {
  const api = inject(WIDGET_CONFIG_PANEL_KEY, null)
  if (!api) throw new Error('useWidgetConfigPanel 必须在配置面板容器内使用')
  return api
}
