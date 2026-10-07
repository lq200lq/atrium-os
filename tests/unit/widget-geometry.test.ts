import { describe, expect, it } from 'vitest'
import { DOCK_ZONE_HEIGHT, TOP_BAR_HEIGHT, type Rect } from '@/kernel/layout'
import {
  BAND_COLS,
  CELL,
  GUTTER,
  MARGIN,
  SIZE_SPAN,
  canPlace,
  cellsOverlap,
  clampIntoBox,
  clampIntoGrid,
  placeWidgets,
  placementBox,
  pxToCell,
  sizePx,
  spanPx,
  widgetGrid,
  type PlacedWidget,
  type PlaceItem,
} from '@/kernel/widget/geometry'
import type { WidgetSize } from '@/kernel/stores/widgetRegistry'

/** 与 desktopBounds() 同式：y 起于顶栏之下，高扣掉顶栏与 Dock 区 */
const boundsOf = (w: number, h: number): Rect => ({
  x: 0,
  y: TOP_BAR_HEIGHT,
  w,
  h: h - TOP_BAR_HEIGHT - DOCK_ZONE_HEIGHT,
})

/** 自动流式项（L-5 缺省态：pos=null 才进 freeSpot） */
const auto = (...sizes: WidgetSize[]): PlaceItem[] =>
  sizes.map((size, i) => ({ id: String(i), size, pos: null }))

const manual = (id: string, size: WidgetSize, col: number, row: number): PlaceItem => ({
  id,
  size,
  pos: { col, row },
})

/* ────────── 几何断言工具箱（T13 的「齐」在这里落地） ────────── */

/** 像素矩形是否真实相交——与 cellsOverlap 不同轴的另一半：格位对了像素也必须真的不咬 */
const rectsIntersect = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

const cellPairs = (placed: PlacedWidget[]): [PlacedWidget, PlacedWidget][] => {
  const out: [PlacedWidget, PlacedWidget][] = []
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) out.push([placed[i], placed[j]])
  }
  return out
}

/**
 * T13 的核心断言（G-1 / L-4，点名 E17）：
 * ① 任意两件 rect 不相交；
 * ② 格位上**横向相邻**（col 恰接、行有重叠）的一对，像素净间距必须**恰好 = GUTTER(24)**；
 * ③ **纵向相邻**（row 恰接、列有重叠）同理。
 * 旧 packRight 测试把纵向间距断言成 0（E17 的根因就藏在那条期望值里）——
 * placeWidgets 补 gutter 后行推进 = 跨高 + GUTTER，这里显式把 24 钉死，防止再退回去。
 */
const assertNetGutter = (placed: PlacedWidget[]): void => {
  for (const [a, b] of cellPairs(placed)) {
    expect(rectsIntersect(a.rect, b.rect), `${a.id} 与 ${b.id} 的 rect 相交`).toBe(false)

    const horizAdjacent =
      a.cell.col === b.cell.col + b.cell.w || b.cell.col === a.cell.col + a.cell.w
    const rowsOverlap = a.cell.row < b.cell.row + b.cell.h && b.cell.row < a.cell.row + a.cell.h
    if (horizAdjacent && rowsOverlap) {
      const [left, right] = a.rect.x <= b.rect.x ? [a, b] : [b, a]
      // 净间距 = 右件左缘 - 左件右缘，必须恰为 GUTTER（不是 0、不是 pitch 余数）
      expect(right.rect.x - (left.rect.x + left.rect.w), `${a.id}/${b.id} 横向净间距`).toBe(GUTTER)
    }

    const vertAdjacent =
      a.cell.row === b.cell.row + b.cell.h || b.cell.row === a.cell.row + a.cell.h
    const colsOverlap = a.cell.col < b.cell.col + b.cell.w && b.cell.col < a.cell.col + a.cell.w
    if (vertAdjacent && colsOverlap) {
      const [top, bottom] = a.rect.y <= b.rect.y ? [a, b] : [b, a]
      expect(bottom.rect.y - (top.rect.y + top.rect.h), `${a.id}/${b.id} 纵向净间距`).toBe(GUTTER)
    }
    // 顺守 G-2：间距只有 GUTTER 一个权威，任何相邻对都不得出现 0 或半格
  }
}

describe('widgetGrid 网格求解（右锚定）', () => {
  it('1280×800：13 列 7 行，网格贴右内边距', () => {
    const g = widgetGrid(boundsOf(1280, 800))
    expect(g).toMatchObject({
      cell: CELL,
      gutter: GUTTER,
      cols: 13,
      rows: 7,
      gridW: 1172, // 13*68 + 12*24
      gridH: 620, // 7*68 + 6*24
      originX: 84, // 1280 - 24 - 1172
      originY: 68, // 44 + 24
    })
    expect(g.originX + g.gridW).toBe(1280 - MARGIN)
    expect(g.originY + g.gridH).toBe(44 + 668 - MARGIN)
  })

  it('1000×800：10 列，网格右缘仍贴右内边距，富余全在左侧', () => {
    const g = widgetGrid(boundsOf(1000, 800))
    expect(g).toMatchObject({ cols: 10, rows: 7, gridW: 896, originX: 80 })
    expect(g.originX + g.gridW).toBe(1000 - MARGIN)
  })

  it('420×800：恰好一个 band（4 列）', () => {
    const g = widgetGrid(boundsOf(420, 800))
    expect(g).toMatchObject({ cols: BAND_COLS, gridW: 344, originX: 52 })
  })

  it('360×800：不足一个 band（3 列），宿主要据此整层隐藏', () => {
    const g = widgetGrid(boundsOf(360, 800))
    expect(g.cols).toBeLessThan(BAND_COLS)
    expect(g).toMatchObject({ gridW: 252, originX: 84 })
  })

  it('缺省取 desktopBounds()：右缘锚定视口右内边距', () => {
    const g = widgetGrid()
    expect(g.originX + g.gridW).toBe(window.innerWidth - MARGIN)
    expect(g.originY).toBe(TOP_BAR_HEIGHT + MARGIN)
  })
})

describe('placementBox / clampIntoBox 跟手夹取（L-2 的「先看清落点」半边）', () => {
  const g = widgetGrid(boundsOf(1280, 800))

  it('贴壁时卡片外缘正好落在网格边：净间距仍是 MARGIN（G-1 在拖拽侧不被破坏）', () => {
    for (const size of ['sm', 'md', 'lg'] as WidgetSize[]) {
      const span = SIZE_SPAN[size]
      const box = placementBox(span, g)
      const px = spanPx(span, g)
      // 夹取区间的右/下端点 + 卡片自身尺寸 = 网格右/下边
      expect(box.x + box.w + px.w).toBe(g.originX + g.gridW)
      expect(box.y + box.h + px.h).toBe(g.originY + g.gridH)
      // 也就是：贴到最右/最下时，到桌面内边距的距离恰为 MARGIN
      expect(g.originX + g.gridW).toBe(1280 - MARGIN)
    }
  })

  it('区间端点与合法格位一一对应（盒子的宽 = (cols-w)·pitch）', () => {
    const pitch = CELL + GUTTER
    const box = placementBox(SIZE_SPAN.md, g)
    expect(box.x).toBe(g.originX)
    expect(box.w).toBe((g.cols - SIZE_SPAN.md.w) * pitch)
    expect(box.y).toBe(g.originY)
    expect(box.h).toBe((g.rows - SIZE_SPAN.md.h) * pitch)
  })

  it('clampIntoBox 把越界左上角拉回区间内，区间内的点原样返回', () => {
    const span = SIZE_SPAN.sm
    const box = placementBox(span, g)
    expect(clampIntoBox({ x: -9999, y: -9999 }, span, g)).toEqual({ x: box.x, y: box.y })
    expect(clampIntoBox({ x: box.x + box.w + 500, y: box.y + box.h + 500 }, span, g)).toEqual({
      x: box.x + box.w,
      y: box.y + box.h,
    })
    const inside = { x: box.x + 37, y: box.y + 11 }
    expect(clampIntoBox(inside, span, g)).toEqual(inside)
  })

  it('夹取与吸附同源：夹取后的点反解出的格位一定合法（不产生越界格）', () => {
    const span = SIZE_SPAN.lg
    const box = placementBox(span, g)
    for (const at of [
      { x: box.x - 300, y: box.y - 300 },
      { x: box.x + box.w + 300, y: box.y + box.h + 300 },
      { x: box.x + 17, y: box.y + box.h - 3 },
    ]) {
      const cell = pxToCell(clampIntoBox(at, span, g), span, g)
      expect(cell.col).toBeGreaterThanOrEqual(0)
      expect(cell.row).toBeGreaterThanOrEqual(0)
      expect(cell.col + span.w).toBeLessThanOrEqual(g.cols)
      expect(cell.row + span.h).toBeLessThanOrEqual(g.rows)
    }
  })
})

describe('spanPx / sizePx 尺寸档换算', () => {
  const g = widgetGrid(boundsOf(1280, 800))

  it('sm / md / lg 三档像素尺寸', () => {
    expect(spanPx(SIZE_SPAN.sm, g)).toEqual({ w: 160, h: 160 })
    expect(spanPx(SIZE_SPAN.md, g)).toEqual({ w: 344, h: 160 })
    expect(spanPx(SIZE_SPAN.lg, g)).toEqual({ w: 344, h: 344 })
  })

  it('sizePx 与 spanPx 同一套几何（预览沙箱不许自造第二套换算，E17 教训）', () => {
    for (const size of ['sm', 'md', 'lg'] as WidgetSize[]) {
      expect(sizePx(size)).toEqual(spanPx(SIZE_SPAN[size], g))
    }
  })
})

describe('占用判定与向内收（L-3 / L-7 的地基）', () => {
  const g = widgetGrid(boundsOf(1280, 800))

  it('cellsOverlap：边贴边不算相交（净间距才有资格恰为 GUTTER）', () => {
    const a = { col: 0, row: 0, w: 2, h: 2 }
    expect(cellsOverlap(a, { col: 2, row: 0, w: 2, h: 2 })).toBe(false) // 横向恰接
    expect(cellsOverlap(a, { col: 1, row: 0, w: 2, h: 2 })).toBe(true) // 差一格就咬
    expect(cellsOverlap(a, { col: 0, row: 2, w: 4, h: 2 })).toBe(false) // 纵向恰接
  })

  it('canPlace：越界或压占到别人的格一律拒', () => {
    const taken = [{ col: 0, row: 0, w: 4, h: 2 }]
    expect(canPlace({ col: 0, row: 0, w: 2, h: 2 }, g, taken)).toBe(false)
    expect(canPlace({ col: 2, row: 2, w: 4, h: 2 }, g, taken)).toBe(true)
    expect(canPlace({ col: 11, row: 6, w: 4, h: 2 }, g, [])).toBe(false) // 右下出界
    expect(canPlace({ col: -1, row: 0, w: 2, h: 2 }, g, [])).toBe(false)
  })

  it('clampIntoGrid：只挪坐标不改跨度（L-7 的第一步）', () => {
    const clamped = clampIntoGrid({ col: 99, row: -3, w: 2, h: 2 }, g)
    expect(clamped).toEqual({ col: 13 - 2, row: 0, w: 2, h: 2 })
    const spanKept = clampIntoGrid({ col: 20, row: 20, w: 4, h: 4 }, g)
    expect(spanKept).toEqual({ col: 9, row: 3, w: 4, h: 4 })
  })
})

describe('pxToCell 吸附取整（L-2，绝不产生半格）', () => {
  const g = widgetGrid(boundsOf(1280, 800))

  it('像素反解出的格位恒为整数，且夹在网格内', () => {
    const cases = [
      { x: 940, y: 80 }, // 落在格中间：round 吸到最近整格
      { x: 84 + 45, y: 68 + 46 }, // 恰好半格的病态输入也要取整
      { x: -500, y: 99999 }, // 越界指针
    ]
    for (const point of cases) {
      const cell = pxToCell(point, SIZE_SPAN.sm, g)
      expect(Number.isInteger(cell.col)).toBe(true)
      expect(Number.isInteger(cell.row)).toBe(true)
      expect(cell.col).toBeGreaterThanOrEqual(0)
      expect(cell.col).toBeLessThanOrEqual(g.cols - SIZE_SPAN.sm.w)
      expect(cell.row).toBeGreaterThanOrEqual(0)
      expect(cell.row).toBeLessThanOrEqual(g.rows - SIZE_SPAN.sm.h)
    }
    expect(pxToCell({ x: 940, y: 80 }, SIZE_SPAN.sm, g)).toEqual({ col: 2, row: 0 })
  })
})

describe('placeWidgets 自动流式（pos=null）：T13 的路径一', () => {
  const g = widgetGrid(boundsOf(1280, 800))

  it('两个 sm 并排占满一个 band，横向净间距恰 = GUTTER', () => {
    const { placed, overflow } = placeWidgets(auto('sm', 'sm'), g)
    expect(overflow).toEqual([])
    // col 从右缘数（L-1/L-7）：首件落 band0 右半（col=2），次件落最右列（col=0）
    expect(placed[0].rect).toEqual({ x: 912, y: 68, w: 160, h: 160 })
    expect(placed[1].rect).toEqual({ x: 1096, y: 68, w: 160, h: 160 })
    assertNetGutter(placed)
  })

  it('md 独占整行，右缘贴网格右缘', () => {
    const { placed } = placeWidgets(auto('md'), g)
    expect(placed[0].rect).toEqual({ x: 912, y: 68, w: 344, h: 160 })
    expect(placed[0].rect.x + placed[0].rect.w).toBe(g.originX + g.gridW)
    expect(placed[0].manual).toBe(false)
  })

  it('行推进补 gutter：半行被 sm 占掉后 md 从下一可用行开始，纵向净间距 = GUTTER（E17 回归点）', () => {
    const { placed } = placeWidgets(auto('sm', 'md'), g)
    expect(placed[0].rect).toEqual({ x: 912, y: 68, w: 160, h: 160 })
    // 旧 packRight 这里是 y=228（行推进只加 h、漏了 gutter → 纵向粘死，E17）
    expect(placed[1].rect).toEqual({ x: 912, y: 252, w: 344, h: 160 })
    assertNetGutter(placed)
  })

  it('一个 band 装满后向左开新 band，跨 band 横向净间距同样 = GUTTER', () => {
    const { placed, overflow } = placeWidgets(auto('md', 'md', 'md', 'md'), g)
    expect(overflow).toEqual([])
    expect(placed.map((p: PlacedWidget) => [p.rect.x, p.rect.y])).toEqual([
      [912, 68],
      [912, 252],
      [912, 436], // rows 4..5，行尾 596 ≤ 688
      [544, 68], // 第二个 band（col=4）
    ])
    assertNetGutter(placed)
  })

  it('左向也开不出 band 时，余下实例进 overflow（不渲染，避免幽灵件，解 E9）', () => {
    const { placed, overflow } = placeWidgets(auto('lg', 'lg', 'lg', 'lg'), g)
    expect(placed.map((p: PlacedWidget) => p.rect.x)).toEqual([912, 544, 176])
    expect(overflow).toEqual([{ id: '3', reason: 'no-space' }])
    // 第三个 band 左缘 176 是最后一个 ≥ originX(84) 的位置
    expect(placed[2].rect.x).toBeGreaterThanOrEqual(g.originX)
    assertNetGutter(placed)
  })

  it('宽度不足一个 band 时全部进 overflow，成因是 no-space', () => {
    const narrow = widgetGrid(boundsOf(360, 800))
    const { placed, overflow } = placeWidgets(auto('md', 'sm'), narrow)
    expect(placed).toEqual([])
    expect(overflow).toEqual([
      { id: '0', reason: 'no-space' },
      { id: '1', reason: 'no-space' },
    ])
  })

  it('空列表不产出', () => {
    expect(placeWidgets([], g)).toEqual({ placed: [], overflow: [] })
  })
})

describe('placeWidgets 手动态（pos 已置）：T13 的路径二', () => {
  const g = widgetGrid(boundsOf(1280, 800))

  it('手动件先落位、流式件绕着它填，两条路径的净间距同 = GUTTER', () => {
    const { placed, overflow } = placeWidgets(
      [manual('m1', 'md', 0, 0), manual('m2', 'sm', 2, 2), ...auto('sm')],
      g,
    )
    expect(overflow).toEqual([])
    const byId = Object.fromEntries(placed.map((p: PlacedWidget) => [p.id, p]))
    expect(byId['m1'].cell).toEqual({ col: 0, row: 0, w: 4, h: 2 })
    expect(byId['m2'].cell).toEqual({ col: 2, row: 2, w: 2, h: 2 })
    // 流式 sm 避开两坨手动占位，落到 band0 (col=0,row=2)
    expect(byId['0'].cell).toEqual({ col: 0, row: 2, w: 2, h: 2 })
    assertNetGutter(placed)
  })

  it('手动件互不重叠：第二件与首件格位相交时退回流式重排（L-3 同口径，不做挤压）', () => {
    const { placed } = placeWidgets([manual('a', 'sm', 0, 0), manual('b', 'sm', 1, 0)], g)
    const byId = Object.fromEntries(placed.map((p: PlacedWidget) => [p.id, p]))
    expect(byId['a'].manual).toBe(true)
    // b 撞格 → 退回流式（此时流式有空位，不该进 overflow）
    expect(byId['b'].manual).toBe(false)
    expect(byId['b'].cell).toEqual({ col: 2, row: 0, w: 2, h: 2 })
    assertNetGutter(placed)
  })

  it('pos 恒为整数 {col,row}，clampIntoGrid + placeWidgets 全程不产生半格（L-1）', () => {
    const { placed } = placeWidgets(
      [
        manual('x', 'lg', 999, 999), // 越界：向内收
        manual('y', 'sm', -5, 3), // 负坐标：向内收
        ...auto('md', 'sm', 'lg', 'sm', 'sm'),
      ],
      g,
    )
    const pitch = CELL + GUTTER
    for (const p of placed) {
      expect(Number.isInteger(p.cell.col)).toBe(true)
      expect(Number.isInteger(p.cell.row)).toBe(true)
      // 像素矩形必须严丝合缝落在整格上：右缘到网格右缘、顶缘到网格顶缘都是 pitch 的整数倍
      expect((g.originX + g.gridW - (p.rect.x + p.rect.w)) % pitch).toBe(0)
      expect((p.rect.y - g.originY) % pitch).toBe(0)
    }
    assertNetGutter(placed)
  })
})
