import { ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Rect } from '../layout'
import type { WidgetSize } from '../stores/widgetRegistry'
import { useWidgets } from '../stores/widgets'
import { useFeedback } from '@/ui/feedback'
import {
  cellRectToPx,
  clampIntoBox,
  pxToCell,
  SIZE_SPAN,
  type CellRect,
  type WidgetCell,
} from './geometry'
import type { WidgetHostLayout } from './host'

/** 拖拽过程中的临时态：只在手势内存活，落定时才写 store（S-4：拖动中不落库） */
export interface GestureState {
  /** 吸附后的落点像素矩形（ghost，画在卡片内相对坐标） */
  ghost: (Rect & { col: number; row: number }) | null
  valid: boolean
  /** 跟手位移：卡片本体用 transform 跟随，避免每帧改 left/top 触发重排（L-6） */
  offset: { x: number; y: number }
}

/** 起手区判定（L-10）：落在件内可交互控件上时不启动拖拽 */
const INTERACTIVE =
  'button, input, textarea, select, a, [role="checkbox"], [data-widget-interactive]'

export interface GestureApi {
  gesture: Ref<GestureState | null>
  startMove(e: PointerEvent): void
  /** 键盘等价物：按格挪动（⌘⇧方向键） */
  nudgeBy(dc: number, dr: number): void
  /** 键盘等价物：在前一/后一已声明档间切换（⌥←/⌥→） */
  stepSize(dir: -1 | 1): void
}

/**
 * 摆放手势层：连续手势 + 离散吸附——拖拽吸到格（L-1/L-2），落点必须整块空（L-3）。
 * 改尺寸没有连续手势：档位是离散档（`SIZE_SPAN`），只能由卡片菜单或 `⌥←/⌥→` 一次换一档（S-1/S-6）；
 * 它与拖拽共用宿主给的同一个占用判定（L-8），因此不会出现「换档能换大、拖过去放不下」这种自相矛盾。
 */
export function usePlacementGestures(opts: {
  instanceId: string
  host: () => WidgetHostLayout | undefined
  rect: () => Rect
  size: () => WidgetSize
  candidates: () => WidgetSize[]
}): GestureApi {
  const { instanceId, host, rect, size, candidates } = opts
  const store = useWidgets()
  const feedback = useFeedback()
  const { t } = useI18n()
  const gesture = ref<GestureState | null>(null)

  function blocked() {
    feedback.warning(t('widgets.placeBlocked'), t('widgets.placeBlockedHint'))
  }

  /** 落点必须整块空（L-3）：不做挤压，越界或相交一律拒绝并回弹 */
  function fits(cell: WidgetCell, atSize: WidgetSize): boolean {
    return host()?.canPlaceFor(instanceId, atSize, cell) ?? true
  }

  /** 把「会落在哪」交给层画（S-4）：卡片自己的坐标系带跟手 transform 且是 overflow-hidden，画不准也裁得掉 */
  function report(g: GestureState | null) {
    host()?.setPreview(
      g?.ghost
        ? {
            id: instanceId,
            rect: { x: g.ghost.x, y: g.ghost.y, w: g.ghost.w, h: g.ghost.h },
            valid: g.valid,
          }
        : null,
    )
  }

  function bind(
    element: EventTarget,
    move: (e: PointerEvent) => void,
    end: (e: PointerEvent) => void,
  ) {
    const el = element as HTMLElement
    const off = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', (e) => {
      off()
      end(e)
    })
    el.addEventListener('pointercancel', (e) => {
      off()
      end(e)
    })
  }

  function start(e: PointerEvent) {
    const layout = host()
    if (!layout) return
    const grid = layout.grid.value
    const startRect = rect()
    const startSize = size()
    const startCell: CellRect = layout.cellOf(instanceId) ?? {
      col: 0,
      row: 0,
      ...SIZE_SPAN[startSize],
    }
    const originX = e.clientX
    const originY = e.clientY
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture?.(e.pointerId)
    gesture.value = {
      ghost: { ...cellRectToPx(startCell, grid), col: startCell.col, row: startCell.row },
      valid: true,
      offset: { x: 0, y: 0 },
    }
    report(gesture.value)

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - originX
      const dy = ev.clientY - originY
      const g = gesture.value
      if (!g) return
      const span = SIZE_SPAN[startSize]
      const at = { x: startRect.x + dx, y: startRect.y + dy }
      const cell = pxToCell(at, span, grid)
      // 跟手视觉夹在摆放域内：越出网格的位置在格模型里落不下去（pxToCell 会夹回），
      // 放任卡片飘出去只会让「拖得动」与「落得下」看起来自相矛盾
      const visual = clampIntoBox(at, span, grid)
      g.offset = { x: visual.x - startRect.x, y: visual.y - startRect.y }
      g.ghost = { ...cellRectToPx({ ...cell, ...span }, grid), ...cell }
      g.valid = fits(cell, startSize)
      report(g)
    }

    const onEnd = () => {
      const g = gesture.value
      gesture.value = null
      report(null)
      if (!g?.ghost) return
      if (!g.valid) {
        blocked()
        return
      }
      const cell: WidgetCell = { col: g.ghost.col, row: g.ghost.row }
      if (cell.col === startCell.col && cell.row === startCell.row) return
      // 首次手动摆放：把全部实例的当前自动格位一次性固化（L-5 / 台账 C-④）
      layout.pinAutoPositions()
      store.setPosition(instanceId, cell)
    }

    bind(target, onMove, onEnd)
  }

  function startMove(e: PointerEvent) {
    if ((e.target as HTMLElement).closest?.(INTERACTIVE)) return
    if (e.button !== 0) return
    e.preventDefault()
    start(e)
  }

  function nudgeBy(dc: number, dr: number) {
    const layout = host()
    if (!layout) return
    const current = layout.cellOf(instanceId)
    if (!current) return
    const cell: WidgetCell = { col: current.col + dc, row: current.row + dr }
    if (!fits(cell, size())) {
      blocked()
      return
    }
    layout.pinAutoPositions()
    store.setPosition(instanceId, cell)
  }

  function stepSize(dir: -1 | 1) {
    const list = candidates()
    if (list.length < 2) return
    const at = list.indexOf(size())
    const next = list[Math.max(0, Math.min(list.length - 1, at + dir))]
    if (next === size()) return
    const layout = host()
    const current = layout?.cellOf(instanceId)
    if (!layout || !current) return
    if (!fits({ col: current.col, row: current.row }, next)) {
      blocked()
      return
    }
    layout.pinAutoPositions()
    store.setSize(instanceId, next)
  }

  return { gesture, startMove, nudgeBy, stepSize }
}
