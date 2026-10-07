<script setup lang="ts">
import { computed, inject, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import OsSkeleton from '@/ui/OsSkeleton.vue'
import ErrorBoundary from '@/windows/ErrorBoundary.vue'
import { useOS } from '@/kernel/composables/useOS'
import { createWidgetContext, provideWidgetContext } from '@/kernel/composables/useWidgetContext'
import { createWidgetDrill } from '@/kernel/composables/useWidgetDrill'
import { useAppName } from '@/i18n'
import { useShellUi, type ContextMenuItem } from '@/kernel/stores/shellUi'
import { type WidgetSize } from '@/kernel/stores/widgetRegistry'
import { useWidgetRuntime } from '@/kernel/stores/widgetRuntime'
import { useWidgets } from '@/kernel/stores/widgets'
import { WIDGET_HOST_KEY } from '@/kernel/widget/host'
import { WIDGET_CARD_CLASS, widgetPaddingClass } from '@/kernel/widget/material'
import { usePlacementGestures } from '@/kernel/widget/usePlacementGestures'
import { useFeedback } from '@/ui/feedback'
import type { Rect } from '@/kernel/layout'

/**
 * 单个小组件实例的壳：材质（表面 token 层）、内边距档、尺寸位、手势与键盘路径、
 * 错误/加载兜底与卡片菜单都在这里；组件只渲染内容，不碰颜色也不碰邻居。
 *
 * 摆放与改尺寸的分工：**摆放是连续手势 + 离散吸附**（拖拽吸到格，L-1~L-10，落定才写 store）；
 * 改尺寸不给拖角手势，只留两个离散入口——卡片菜单的档位组与键盘 `⌥←/⌥→`（同一档集合，同一占用判定 L-8）。
 * 卡片表面因此不承载任何宿主自绘的浮标：移除/配置/刷新/下钻一律从右键菜单走。
 */
const props = defineProps<{ instanceId: string; rect: Rect }>()
/** 上下文由这里建好再 provide：件内与这里的下钻 payload 读的是同一份派生值 */
const ctx = provideWidgetContext(createWidgetContext(props.instanceId))

const store = useWidgets()
const runtime = useWidgetRuntime()
const ui = useShellUi()
const os = useOS()
const feedback = useFeedback()
const { t } = useI18n()
const appName = useAppName()

const host = inject(WIDGET_HOST_KEY, null)

const instance = ctx.instance
const kindId = ctx.kindId
const manifest = ctx.manifest
const name = computed(() => appName(manifest.value))
const sizes = computed<WidgetSize[]>(() => manifest.value?.widget.sizes ?? [])
const resizable = computed(() => sizes.value.length > 1)

/** 内边距由宿主给（G-2 同一条口径：间距与内边距都是平台常量，件侧不可声明） */
const paddingClass = computed(() => widgetPaddingClass(ctx.padding.value))

const style = computed(() => ({
  left: `${props.rect.x}px`,
  top: `${props.rect.y}px`,
  width: `${props.rect.w}px`,
  height: `${props.rect.h}px`,
}))

const gestures = usePlacementGestures({
  instanceId: props.instanceId,
  host: () => host ?? undefined,
  rect: () => props.rect,
  size: () => ctx.size.value,
  candidates: () => sizes.value,
})
const gesture = gestures.gesture

/** 跟手位移走 transform（L-6：每帧改 left/top 会触发重排）；位移已在手势层夹进摆放域 */
const dragStyle = computed(() =>
  gesture.value
    ? { transform: `translate3d(${gesture.value.offset.x}px, ${gesture.value.offset.y}px, 0)` }
    : null,
)

/* ── 下钻（§4.5）：交互型件不接管整块点击；目标应用不可访问时整块点击与菜单项一起消失 ── */
const drill = createWidgetDrill(ctx)
/** 展示型（未声明 interactive）才「点空白处就进到该看的地方」；交互/混合型把点击域留给件 */
const wholeCardClickable = computed(
  () => Boolean(drill.target.value) && !manifest.value?.interactive,
)

function drillNow() {
  if (drill.target.value) drill.open()
}

/* ── 点击与拖拽的区分：拖过的手势不应当成一次点击 ── */
const downAt = ref<{ x: number; y: number } | null>(null)

function onPointerDown(e: PointerEvent) {
  downAt.value = { x: e.clientX, y: e.clientY }
  gestures.startMove(e)
}

function onClick(e: MouseEvent) {
  const from = downAt.value
  downAt.value = null
  if (gesture.value) return
  if (from && (Math.abs(e.clientX - from.x) > 3 || Math.abs(e.clientY - from.y) > 3)) return
  if ((e.target as HTMLElement).closest?.('button, input, textarea, select, a')) return
  if (!wholeCardClickable.value) return
  drillNow()
}

/* ── 键盘路径（§4.5 / S-6 / L-6）：卡片本体可聚焦，手势动作都有键盘等价物 ── */
function onKeydown(e: KeyboardEvent) {
  const el = e.target as HTMLElement
  if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault()
    gestures.stepSize(e.key === 'ArrowRight' ? 1 : -1)
    return
  }
  if (e.metaKey && e.shiftKey && e.key.startsWith('Arrow')) {
    e.preventDefault()
    const dc = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
    const dr = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
    // col 从视口右缘数，所以「视觉向右」是 col 减一
    gestures.nudgeBy(-dc, dr)
    return
  }
  if (e.metaKey && (e.key === ']' || e.key === '[')) {
    e.preventDefault()
    void moveInOrder(e.key === ']' ? 1 : -1)
    return
  }
  if (el !== e.currentTarget) return
  if (e.key === 'Enter') {
    e.preventDefault()
    drillNow()
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    void onRemove()
  }
}

async function moveInOrder(dir: 1 | -1) {
  const view = store.renderable
  const at = view.findIndex((i) => i.id === props.instanceId)
  if (at === -1) return
  if (instance.value?.pos) {
    feedback.info(t('widgets.placedManual'))
    return
  }
  const to = Math.max(0, Math.min(view.length - 1, at + dir))
  if (to !== at) store.move(props.instanceId, to)
  // §4.5 键盘路径连续性：改序会重排列表、卡片节点被重建，焦点掉回 body——
  // 于是这条快捷键只能连按一次，等价于没有。落定后把焦点还给同一张卡。
  await nextTick()
  document.querySelector<HTMLElement>(`[data-widget-id="${props.instanceId}"]`)?.focus()
}

async function onRemove() {
  const ok = await feedback.confirm({
    title: t('widgets.removeConfirm', { name: name.value }),
    content: t('widgets.dataIntro'),
  })
  if (ok) store.remove(props.instanceId)
}

function openConfig() {
  ui.openWidgetConfig(props.instanceId)
}

/**
 * 卡片菜单：尺寸组（多档才给）→ 配置… → 立即刷新（声明了 refresh 才有）
 * → 打开应用（下钻可达才有）→ 退回自动摆放（手动态才有）→ 管理小组件… → 移除。
 * 配置面板本体归宿主（§4.12）：这里只给入口，弹层与容器由 `WidgetLayer` 管。
 */
const menuItems = computed<ContextMenuItem[]>(() => {
  const items: ContextMenuItem[] = []
  if (resizable.value) {
    for (const size of sizes.value) {
      items.push({
        key: `size:${size}`,
        label: t(`widgets.sizes.${size}`),
        checked: instance.value?.size === size,
        run: () => store.setSize(props.instanceId, size),
      })
    }
  }
  if (manifest.value?.config?.length) {
    items.push({
      key: 'config',
      label: t('widgets.configure'),
      separatorBefore: items.length > 0,
      run: openConfig,
    })
  }
  if (manifest.value?.refresh && manifest.value.refresh !== 'manual') {
    items.push({
      key: 'refresh',
      label: t('widgets.refreshNow'),
      separatorBefore: items.length > 0,
      run: () => runtime.requestRefresh(props.instanceId),
    })
  }
  if (drill.target.value) {
    items.push({
      key: 'open-app',
      label: t('widgets.openApp'),
      separatorBefore: items.length > 0,
      run: drillNow,
    })
  }
  if (instance.value?.pos) {
    items.push({
      key: 'release',
      label: t('widgets.releasePlacement'),
      separatorBefore: items.length > 0,
      run: () => store.releasePosition(props.instanceId),
    })
  }
  items.push({
    key: 'manage',
    label: t('widgets.manage'),
    separatorBefore: items.length > 0,
    // 带着「是哪张卡」进管理面：中心窗口的实例行会展开并滚到视线里（§4.5）
    run: () => {
      ui.focusInstance(props.instanceId)
      os.open('widget-center')
    },
  })
  items.push({ key: 'remove', label: t('widgets.remove'), danger: true, run: onRemove })
  return items
})

function onContext(e: MouseEvent) {
  if (gesture.value) return
  ui.openContextMenu(e.clientX, e.clientY, menuItems.value)
}
</script>

<template>
  <section
    role="group"
    :aria-label="name"
    :data-widget-id="instanceId"
    :data-widget-kind="kindId"
    :data-widget-size="instance?.size"
    :data-widget-placed="instance?.pos ? 'manual' : 'auto'"
    tabindex="0"
    class="group pointer-events-auto absolute"
    :class="[
      WIDGET_CARD_CLASS,
      wholeCardClickable && 'cursor-pointer',
      gesture && 'transition-none select-none',
    ]"
    :style="[style, dragStyle]"
    @pointerdown="onPointerDown"
    @click="onClick"
    @contextmenu.prevent="onContext"
    @keydown="onKeydown"
  >
    <div data-widget-content class="h-full" :class="paddingClass">
      <ErrorBoundary :app-id="`widget:${instanceId}`">
        <Suspense>
          <component :is="manifest?.component" v-if="manifest" />
          <template #fallback>
            <OsSkeleton :rows="3" />
          </template>
        </Suspense>
      </ErrorBoundary>
    </div>

    <!-- 吸附预览框（S-4）由宿主层画：卡片自己是跟手 transform + overflow-hidden，
         画在这里会被指针位移带走、越出卡片本体还会被裁（见 host.ts 的 setPreview） -->
  </section>
</template>
