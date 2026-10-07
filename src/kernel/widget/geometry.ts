import { clamp, desktopBounds, type Rect } from '../layout'
import type { WidgetSize } from '../stores/widgetRegistry'

/* 网格常量：cell/gutter 由 macOS 小组件真实比例反解（small≈158、medium≈344），
 * gutter 吸到间距刻度 --spacing-lg(24)，因此「n 格」= n*CELL + (n-1)*GUTTER。 */
export const CELL = 68
export const GUTTER = 24
export const MARGIN = 24

/** 一个 band = medium/large 的宽度（4 列）；两个 small 并排刚好铺满一个 band */
export const BAND_COLS = 4

/** 尺寸档 → 跨列跨行 */
export const SIZE_SPAN: Record<WidgetSize, { w: number; h: number }> = {
  sm: { w: 2, h: 2 }, // 160 x 160
  md: { w: 4, h: 2 }, // 344 x 160
  lg: { w: 4, h: 4 }, // 344 x 344
}

export interface WidgetGrid {
  cell: number
  gutter: number
  cols: number
  rows: number
  /** 网格最左列 x / 首行 y（px） */
  originX: number
  originY: number
  /** 网格整体宽高（px） */
  gridW: number
  gridH: number
}

/**
 * 由桌面可用区解出网格。**右锚定**：网格右缘固定贴桌面右内边距，富余留在左侧，
 * 这样「小组件永远贴右缘」与视口宽度无关，缩窗只需减少列数。
 */
export function widgetGrid(bounds: Rect = desktopBounds()): WidgetGrid {
  const cols = Math.max(0, Math.floor((bounds.w - 2 * MARGIN + GUTTER) / (CELL + GUTTER)))
  const rows = Math.max(0, Math.floor((bounds.h - 2 * MARGIN + GUTTER) / (CELL + GUTTER)))
  const gridW = cols > 0 ? cols * CELL + (cols - 1) * GUTTER : 0
  const gridH = rows > 0 ? rows * CELL + (rows - 1) * GUTTER : 0
  return {
    cell: CELL,
    gutter: GUTTER,
    cols,
    rows,
    originX: bounds.x + bounds.w - MARGIN - gridW,
    originY: bounds.y + MARGIN,
    gridW,
    gridH,
  }
}

/** 跨列跨行 → 像素尺寸 */
export function spanPx(span: { w: number; h: number }, grid: WidgetGrid): { w: number; h: number } {
  return {
    w: span.w * grid.cell + (span.w - 1) * grid.gutter,
    h: span.h * grid.cell + (span.h - 1) * grid.gutter,
  }
}

/**
 * 尺寸档 → 桌面像素宽高（不依赖视口的那份换算）。
 * 预览沙箱用它：缩略必须与桌面**同一套几何**，否则管理面里看着合适、上桌面就溢出（E17 的老路）。
 */
export function sizePx(size: WidgetSize): { w: number; h: number } {
  const span = SIZE_SPAN[size]
  return {
    w: span.w * CELL + (span.w - 1) * GUTTER,
    h: span.h * CELL + (span.h - 1) * GUTTER,
  }
}

/**
 * 整数网格坐标（L-1）：`col` 从**视口右缘往左数**（col=0 是最右列），`row` 自上而下。
 * 列序取右锚定而不是左起，是为了视口变窄时「贴右的仍贴右」——若从左数，缩窗会让
 * 全部件整体横移，用户摆的位置看起来像被系统改掉了（L-7）。
 */
export interface WidgetCell {
  col: number
  row: number
}

/** 格子矩形：坐标 + 跨度（跨度仍由 size 经 SIZE_SPAN 解出，不进 pos） */
export interface CellRect extends WidgetCell {
  w: number
  h: number
}

/** 格子矩形 → 像素矩形。间距由「一格 = CELL、相邻格之间恒为 GUTTER」天然保证（G-1/L-4）。 */
export function cellRectToPx(cell: CellRect, grid: WidgetGrid): Rect {
  const pitch = grid.cell + grid.gutter
  return {
    x: grid.originX + (grid.cols - cell.col - cell.w) * pitch,
    y: grid.originY + cell.row * pitch,
    ...spanPx({ w: cell.w, h: cell.h }, grid),
  }
}

/** 两个格子矩形是否在格位上相交（L-3/L-8 共用的唯一占用判定） */
export function cellsOverlap(a: CellRect, b: CellRect): boolean {
  return a.col < b.col + b.w && b.col < a.col + a.w && a.row < b.row + b.h && b.row < a.row + a.h
}

/** 该格位集合是否落进网格且与 taken 全部不相交 */
export function canPlace(cell: CellRect, grid: WidgetGrid, taken: CellRect[]): boolean {
  if (cell.col < 0 || cell.row < 0) return false
  if (cell.col + cell.w > grid.cols || cell.row + cell.h > grid.rows) return false
  return !taken.some((t) => cellsOverlap(t, cell))
}

/**
 * 该跨度能落在的像素区间（跟手拖动时卡片**左上角**的允许范围）：`x ∈ [box.x, box.x+box.w]`、`y` 同理。
 * 贴壁时卡片外缘正好落在网格边：`box.x + box.w + spanPx(span).w === originX + gridW`，
 * 因此净间距仍是 `MARGIN`（G-1 在拖拽侧不被破坏）。
 * 跟手视觉要夹在这里面：越出网格的落点在格模型里不可能成立（`pxToCell` 会夹回去），
 * 放任卡片飘到摆放域外只会制造「拖得动、落不下」的错觉——L-2 要的是先看清落点，不是先看见一个假位置。
 */
export function placementBox(span: { w: number; h: number }, grid: WidgetGrid): Rect {
  const pitch = grid.cell + grid.gutter
  return {
    x: grid.originX,
    y: grid.originY,
    w: Math.max(0, grid.cols - span.w) * pitch,
    h: Math.max(0, grid.rows - span.h) * pitch,
  }
}

/** 把卡片左上角夹进摆放域（返回夹取后的左上角坐标） */
export function clampIntoBox(
  point: { x: number; y: number },
  span: { w: number; h: number },
  grid: WidgetGrid,
): { x: number; y: number } {
  const box = placementBox(span, grid)
  return {
    x: clamp(point.x, box.x, box.x + box.w),
    y: clamp(point.y, box.y, box.y + box.h),
  }
}

/** 向内收：把越界的件拉回网格内（只挪坐标，不改跨度，L-7 的第一步） */
export function clampIntoGrid(cell: CellRect, grid: WidgetGrid): CellRect {
  return {
    ...cell,
    col: Math.min(Math.max(cell.col, 0), Math.max(0, grid.cols - cell.w)),
    row: Math.min(Math.max(cell.row, 0), Math.max(0, grid.rows - cell.h)),
  }
}

/** 指针像素 → 吸附后的格位（L-2）：给定拖动中的卡片左上角像素与跨度，反解出 col/row */
export function pxToCell(
  point: { x: number; y: number },
  span: { w: number; h: number },
  grid: WidgetGrid,
): WidgetCell {
  const pitch = grid.cell + grid.gutter
  const fromLeft = Math.round((point.x - grid.originX) / pitch)
  const row = Math.round((point.y - grid.originY) / pitch)
  // from-left 下标换算回「从右缘数」的列序，并夹住跨度
  const col = grid.cols - fromLeft - span.w
  return {
    col: Math.max(0, Math.min(col, grid.cols - span.w)),
    row: Math.max(0, Math.min(row, grid.rows - span.h)),
  }
}

export interface PlaceItem {
  id: string
  size: WidgetSize
  /** null = 参与自动流式（L-5 缺省态） */
  pos: WidgetCell | null
}

export interface PlacedWidget {
  id: string
  rect: Rect
  cell: CellRect
  /** true = 用户摆的那一格（手动态，排序动作对它置灰，L-9） */
  manual: boolean
}

export type OverflowReason = 'no-space' | 'out-of-range' | 'collision'

export interface OverflowEntry {
  id: string
  reason: OverflowReason
}

export interface PackResult {
  placed: PlacedWidget[]
  /** 放不下的实例：不渲染，由宿主给「是哪些 + 处置动作」的出口（解 E9） */
  overflow: OverflowEntry[]
}

/**
 * 自动流式的一个落点：从最右 band 起，band 内自上而下、同一行从左到右找**第一个整块空位**。
 * 已被手动件占住的格位自然跳过（不做挤压，L-3 的同一条口径）。
 */
function freeSpot(size: WidgetSize, grid: WidgetGrid, taken: CellRect[]): CellRect | null {
  const span = SIZE_SPAN[size]
  const bands = Math.floor(grid.cols / BAND_COLS)
  for (let band = 0; band < bands; band++) {
    const base = band * BAND_COLS
    for (let row = 0; row + span.h <= grid.rows; row++) {
      for (let col = base + BAND_COLS - span.w; col >= base; col -= span.w) {
        const cell = { col, row, ...span }
        if (!taken.some((t) => cellsOverlap(t, cell))) return cell
      }
    }
  }
  return null
}

/**
 * 摆放求解：手动态先落位（数组序即落位序），其余按自动流式填空位；
 * 越界先向内收，收完仍与别人相交就退回流式重排（L-7），两者都落不下才进 overflow。
 * 结果确定、可逐条断言（纵向补 gutter 后，任何两件四向净间距恒＝GUTTER，G-1）。
 */
export function placeWidgets(items: PlaceItem[], grid: WidgetGrid): PackResult {
  const placed: PlacedWidget[] = []
  const overflow: OverflowEntry[] = []
  const taken: CellRect[] = []
  if (grid.cols < BAND_COLS || grid.gridW <= 0 || grid.gridH <= 0) {
    return { placed, overflow: items.map((i) => ({ id: i.id, reason: 'no-space' as const })) }
  }

  const deferred: PlaceItem[] = []
  /** 退回流式的那些实例的成因，供溢出清单说「为什么没显示」 */
  const fellBack = new Map<string, OverflowReason>()
  for (const item of items) {
    if (!item.pos) {
      deferred.push(item)
      continue
    }
    const wanted: CellRect = { col: item.pos.col, row: item.pos.row, ...SIZE_SPAN[item.size] }
    const clamped = clampIntoGrid(wanted, grid)
    // L-7：向内收之后若整块仍放得下且没撞上谁，它就还按用户摆的那一格（收过的）显示；
    // 只有「收完仍然相交 / 本就收不下」才退回流式，并把成因留给溢出清单
    if (canPlace(clamped, grid, taken)) {
      taken.push(clamped)
      placed.push({ id: item.id, rect: cellRectToPx(clamped, grid), cell: clamped, manual: true })
      continue
    }
    deferred.push({ ...item, pos: null })
    fellBack.set(
      item.id,
      clamped.col !== wanted.col || clamped.row !== wanted.row ? 'out-of-range' : 'collision',
    )
  }

  for (const item of deferred) {
    const cell = freeSpot(item.size, grid, taken)
    if (!cell) {
      overflow.push({ id: item.id, reason: fellBack.get(item.id) ?? 'no-space' })
      continue
    }
    taken.push(cell)
    placed.push({
      id: item.id,
      rect: cellRectToPx(cell, grid),
      cell,
      manual: false,
    })
  }

  return { placed, overflow }
}
