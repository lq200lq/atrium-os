<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OsAppTile from '@/components/OsAppTile.vue'
import OsIcon from '@/components/OsIcon.vue'
import WidgetConfigPanel from '@/components/WidgetConfigPanel.vue'
import WidgetFrame from './WidgetFrame.vue'
import { useAppName } from '@/i18n'
import { desktopBoundsOf, DOCK_ZONE_HEIGHT, type Rect } from '@/kernel/layout'
import { useShellUi } from '@/kernel/stores/shellUi'
import {
  useWidgetRegistry,
  type WidgetRefresh,
  type WidgetSize,
} from '@/kernel/stores/widgetRegistry'
import { useWidgetRuntime, type PlacementState } from '@/kernel/stores/widgetRuntime'
import { useWidgets } from '@/kernel/stores/widgets'
import {
  BAND_COLS,
  canPlace,
  MARGIN,
  placeWidgets,
  SIZE_SPAN,
  widgetGrid,
  type CellRect,
  type WidgetCell,
} from '@/kernel/widget/geometry'
import { isDue, REFRESH_PERIOD, setSuspended, subscribeTick } from '@/kernel/widget/scheduler'
import { WIDGET_HOST_KEY, type WidgetPreviewState } from '@/kernel/widget/host'

/**
 * 桌面小组件宿主层：几何与摆放的**唯一权威**在这里——算网格、解 `placeWidgets()`、
 * 把格位与占用判定注入给卡片（`WIDGET_HOST_KEY`），卡片因此不认识视口也不认识邻居。
 * 本层在窗口层之下（z-desktop=5），本体不吃指针事件：卡片间隙的右键仍落到桌面。
 */
const widgets = useWidgets()
const runtime = useWidgetRuntime()
const registry = useWidgetRegistry()
const ui = useShellUi()
const { t } = useI18n()
const appName = useAppName()

const viewport = ref({ w: window.innerWidth, h: window.innerHeight })
function syncViewport() {
  viewport.value = { w: window.innerWidth, h: window.innerHeight }
}
onMounted(() => window.addEventListener('resize', syncViewport))
onUnmounted(() => window.removeEventListener('resize', syncViewport))

const bounds = computed<Rect>(() => desktopBoundsOf(viewport.value.w, viewport.value.h))
const grid = computed(() => widgetGrid(bounds.value))

/** 放得下一个完整 band 才显示整层（自适应单位是「列」，不是屏幕断点） */
const mounted = computed(() => grid.value.cols >= BAND_COLS)

const layout = computed(() =>
  placeWidgets(
    widgets.visible.map((i) => ({ id: i.id, size: i.size, pos: i.pos })),
    grid.value,
  ),
)

const cellsById = computed(() => {
  const map = new Map<string, CellRect>()
  for (const p of layout.value.placed) map.set(p.id, p.cell)
  return map
})

function takenExcept(id: string): CellRect[] {
  return layout.value.placed.filter((p) => p.id !== id).map((p) => p.cell)
}

/**
 * 手势中的落点预览（S-4/L-2）。**由层来画**：卡片的坐标系被跟手 `transform` 平移过、
 * 材质又是 `overflow-hidden`，预览画在卡片里会被指针带走并被裁掉——落点等于当前格时
 * 它与卡片完全重合，用户等于没有反馈（2026-10-07 的实测缺陷，见设计文档偏差 28）。
 */
const preview = ref<WidgetPreviewState | null>(null)
const previewStyle = computed(() =>
  preview.value
    ? {
        left: `${preview.value.rect.x}px`,
        top: `${preview.value.rect.y}px`,
        width: `${preview.value.rect.w}px`,
        height: `${preview.value.rect.h}px`,
      }
    : null,
)

provide(WIDGET_HOST_KEY, {
  grid,
  cellOf: (id: string) => cellsById.value.get(id) ?? null,
  takenExcept,
  canPlaceFor: (id: string, size: WidgetSize, cell: WidgetCell) =>
    canPlace({ ...cell, ...SIZE_SPAN[size] }, grid.value, takenExcept(id)),
  pinAutoPositions: () =>
    widgets.pinPositions(
      Object.fromEntries(
        layout.value.placed.map((p) => [p.id, { col: p.cell.col, row: p.cell.row }]),
      ),
    ),
  setPreview: (state: WidgetPreviewState | null) => {
    preview.value = state
  },
})

/** 摆放结果同步进运行态：件与溢出口都从那里读，层本身不向件传 props */
const bandsUsed = computed(() => {
  let band = 0
  for (const item of layout.value.placed) {
    // col 从右缘数，band 0 是最右一个 band；跨到下一 band 的件算两个
    band = Math.max(band, Math.floor((item.cell.col + item.cell.w - 1) / BAND_COLS) + 1)
  }
  return band
})

/** 上桌面的那些件的外接矩形（无件则为 null）：让位判定要能看见「一个 band 也压到左边」 */
const usedRect = computed<Rect | null>(() => {
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const item of layout.value.placed) {
    x1 = Math.min(x1, item.rect.x)
    y1 = Math.min(y1, item.rect.y)
    x2 = Math.max(x2, item.rect.x + item.rect.w)
    y2 = Math.max(y2, item.rect.y + item.rect.h)
  }
  if (!Number.isFinite(x1)) return null
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
})

watch(
  [layout, bandsUsed],
  ([result, bands]) => {
    // 卡片在拖动途中被移除（键盘 Delete 那条路径）时手势不再有机会收尾，
    // 落点预览会留在层上——层是这份状态的持有者，所以由它顺手判死
    const active = preview.value
    if (active && !result.placed.some((p) => p.id === active.id)) preview.value = null
    const entries: Record<string, PlacementState> = {}
    for (const id of widgets.visible.map((i) => i.id)) {
      const placed = result.placed.find((p) => p.id === id)
      const over = result.overflow.find((o) => o.id === id)
      entries[id] = {
        visible: Boolean(placed),
        overflow: placed ? null : (over?.reason ?? 'no-space'),
        manual: Boolean(placed?.manual),
      }
    }
    runtime.syncPlacement(entries, bands, usedRect.value)
  },
  { immediate: true },
)

/* ── 取数节奏（§4.3）：manifest.refresh 决定周期，件只暴露 onRefresh + markRefreshed。
 * 每一档只有**一个**共享定时器（scheduler 内部按 ms 归并），实例再多也不会挂出一排 interval（解 E11）。
 * 每档定时器都叫同一个 scanDue：到没到点由 isDue 判，所以粗档扫到细档也不会提前触发。 */
const PERIODS = (Object.keys(REFRESH_PERIOD) as WidgetRefresh[]).filter(
  (refresh) => REFRESH_PERIOD[refresh] !== null,
)

let dayKey = new Date().toDateString()

function scanDue(now: number) {
  const today = new Date().toDateString()
  const dayChanged = today !== dayKey
  if (dayChanged) dayKey = today
  for (const item of widgets.visible) {
    const refresh = registry.byId(item.kindId)?.refresh
    if (!refresh) continue
    if (!isDue(runtime.lastRefreshAt[item.id] ?? 0, refresh, now, dayChanged)) continue
    runtime.requestRefresh(item.id)
  }
}

let stopTicks: (() => void)[] = []

function onVisibility() {
  setSuspended(document.hidden)
  // 回到前台补一次：挂起期间到点的件不该等到下一个周期才更新
  if (!document.hidden) scanDue(Date.now())
}

onMounted(() => {
  stopTicks = PERIODS.map((refresh) =>
    subscribeTick(REFRESH_PERIOD[refresh] as number, () => scanDue(Date.now())),
  )
  document.addEventListener('visibilitychange', onVisibility)
  setSuspended(document.hidden)
})

onUnmounted(() => {
  for (const stop of stopTicks) stop()
  stopTicks = []
  document.removeEventListener('visibilitychange', onVisibility)
})

const overflowEntries = computed(() => runtime.overflowEntries)
const overflowOpen = ref(false)
const overflowStyle = computed(() => ({
  right: `${MARGIN}px`,
  bottom: `${DOCK_ZONE_HEIGHT + MARGIN}px`,
}))

/** 溢出治理（§4.7 第 3 步）：给「是哪些 + 为什么 + 就地处置」，不留黑箱数字 */
function shrink(entryId: string) {
  const instance = widgets.byId(entryId)
  if (!instance) return
  const sizes = registry.byId(instance.kindId)?.widget.sizes ?? []
  const at = sizes.indexOf(instance.size)
  if (at <= 0) return
  widgets.setSize(entryId, sizes[at - 1] as WidgetSize)
}

function canShrink(entryId: string): boolean {
  const instance = widgets.byId(entryId)
  if (!instance) return false
  const sizes = registry.byId(instance.kindId)?.widget.sizes ?? []
  return sizes.indexOf(instance.size) > 0
}

function removeOverflow(entryId: string) {
  widgets.remove(entryId)
  if (!widgets.byId(entryId)) overflowOpen.value = false
}

function nameOf(entryId: string): string {
  const instance = widgets.byId(entryId)
  return appName(instance ? registry.byId(instance.kindId) : undefined)
}

function sizeOf(entryId: string): string {
  const instance = widgets.byId(entryId)
  return instance ? t(`widgets.sizes.${instance.size}`) : ''
}

/* ── 卡片菜单「配置…」弹层（§4.12）：外壳在这里、面板本体与管理面同一份实现。
 * 没直接套 OsDialog：它的「取消/确认」一排与面板页脚的「恢复默认/完成」是同一件事的两份表达（E8 的病）。 */
const configPanelEl = ref<HTMLElement | null>(null)
const configOpener = ref<HTMLElement | null>(null)

const configKind = computed(() => {
  const instance = ui.configInstanceId ? widgets.byId(ui.configInstanceId) : undefined
  return instance ? registry.byId(instance.kindId) : undefined
})

watch(
  () => ui.configInstanceId,
  () => {
    if (ui.configInstanceId) {
      const active = document.activeElement
      configOpener.value = active instanceof HTMLElement && active !== document.body ? active : null
      void nextTick(() => configPanelEl.value?.focus())
      return
    }
    if (configOpener.value?.isConnected) configOpener.value.focus()
    configOpener.value = null
  },
)
</script>

<template>
  <div v-if="mounted" data-widget-layer class="pointer-events-none absolute inset-0 z-desktop">
    <WidgetFrame
      v-for="item in layout.placed"
      :key="item.id"
      :instance-id="item.id"
      :rect="item.rect"
    />

    <!-- 落点预览（S-4/L-2）：与卡片同一套桌面坐标，所以直接贴吸附后的整格位。
         在卡片之后渲染 ⇒ 落点等于当前格时也看得见（画在卡内会被自己盖住）。
         `transition-none` 同 L-6 对卡片的要求：预览必须**当场**跳到新格位、不能补间
         （全局把 transition-duration 设成了非 0，任何属性变化都会迟一帧落地）。 -->
    <div
      v-if="previewStyle"
      data-widget-ghost
      class="pointer-events-none absolute rounded-dock border-2 transition-none"
      :class="
        preview?.valid ? 'border-widget-line bg-widget-fill' : 'border-danger-border bg-danger-bg'
      "
      :style="previewStyle"
    />

    <!-- 放不下的实例不渲染（不做静默裁剪），出口给在这里 -->
    <div v-if="overflowEntries.length" class="pointer-events-auto absolute" :style="overflowStyle">
      <button
        type="button"
        class="flex items-center gap-2xs rounded-full border border-widget-border bg-widget-surface px-sm py-2xs text-caption text-widget-ink shadow-raise backdrop-blur-xl transition duration-quick hover:border-widget-line"
        :aria-expanded="overflowOpen"
        aria-controls="widget-overflow-list"
        @click="overflowOpen = !overflowOpen"
      >
        <OsIcon name="eye-off" :size="14" />
        {{ t('widgets.overflow', { n: overflowEntries.length }) }}
      </button>

      <ul
        v-if="overflowOpen"
        id="widget-overflow-list"
        class="absolute right-0 bottom-full mb-xs w-[var(--container-md)] max-w-[calc(100vw-48px)] rounded-surface border border-line bg-surface p-xs shadow-pop"
      >
        <li class="px-2xs py-2xs text-caption text-ink-mute">
          {{ t('widgets.overflowTitle') }}
        </li>
        <li
          v-for="entry in overflowEntries"
          :key="entry.id"
          data-widget-overflow-entry
          :data-instance-id="entry.id"
          class="flex items-center gap-xs rounded-chip px-2xs py-2xs"
        >
          <OsAppTile
            :icon="registry.byId(widgets.byId(entry.id)?.kindId ?? '')?.icon ?? 'puzzle'"
            :tint="registry.byId(widgets.byId(entry.id)?.kindId ?? '')?.tint"
            size="sm"
          />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-ui font-strong text-ink">{{ nameOf(entry.id) }}</span>
            <span class="block truncate text-caption text-ink-mute">
              {{ sizeOf(entry.id) }} · {{ t(`widgets.overflowReason.${entry.reason}`) }}
            </span>
          </span>
          <button
            v-if="canShrink(entry.id)"
            type="button"
            class="rounded-control px-2xs py-2xs text-caption text-accent-text transition duration-quick hover:bg-accent-bg"
            @click="shrink(entry.id)"
          >
            {{ t('widgets.shrinkOne') }}
          </button>
          <button
            type="button"
            class="flex items-center rounded-control px-2xs py-2xs text-caption text-ink-mute transition duration-quick hover:bg-surface-hover"
            :aria-label="t('widgets.overflowLocate')"
            @click="ui.openWidgetGallery(entry.id)"
          >
            <OsIcon name="chevron-right" :size="14" />
          </button>
          <button
            type="button"
            class="flex items-center rounded-control px-2xs py-2xs text-caption text-danger-text transition duration-quick hover:bg-danger-bg"
            :aria-label="t('widgets.remove')"
            @click="removeOverflow(entry.id)"
          >
            <OsIcon name="trash-2" :size="14" />
          </button>
        </li>
        <li class="mt-2xs border-t border-line-soft pt-2xs">
          <button
            type="button"
            class="w-full rounded-control px-2xs py-2xs text-left text-caption text-ink-mute transition duration-quick hover:bg-surface-hover"
            @click="ui.openWidgetGallery()"
          >
            {{ t('widgets.manage') }}
          </button>
        </li>
      </ul>
    </div>
  </div>

  <!-- 配置弹层：不进 v-if="mounted"，窄桌面上的件仍可配置；层级与 ContextMenu 同族（根级浮层） -->
  <div
    v-if="ui.configInstanceId && configKind"
    data-widget-config-dialog
    class="absolute inset-0 z-float flex items-center justify-center bg-scrim"
    @pointerdown.self="ui.closeWidgetConfig()"
  >
    <div
      ref="configPanelEl"
      role="dialog"
      aria-modal="true"
      :aria-label="`${appName(configKind)} ${t('widgets.configure')}`"
      class="w-72 max-w-[calc(100vw-32px)] rounded-surface bg-surface p-md shadow-pop"
      tabindex="-1"
    >
      <WidgetConfigPanel :instance-id="ui.configInstanceId" @close="ui.closeWidgetConfig()" />
    </div>
  </div>
</template>
