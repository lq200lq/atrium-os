import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import type { Rect } from '@/kernel/layout'
import {
  CELL,
  GUTTER,
  SIZE_SPAN,
  canPlace,
  cellRectToPx,
  clampIntoGrid,
  placeWidgets,
  widgetGrid,
  type CellRect,
  type PlaceItem,
  type PlacedWidget,
  type WidgetGrid,
} from '@/kernel/widget/geometry'
import type { WidgetHostLayout } from '@/kernel/widget/host'
import { usePlacementGestures, type GestureApi } from '@/kernel/widget/usePlacementGestures'
import { provideFeedback, type FeedbackApi } from '@/ui/feedback'
import {
  useWidgetRegistry,
  type WidgetManifest,
  type WidgetSize,
} from '@/kernel/stores/widgetRegistry'
import { useWidgets } from '@/kernel/stores/widgets'

/* mock IDB：摆放规则不碰真库，沿用 widgets.test.ts 的口径 */
const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))
vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, structuredClone(value))
  }),
}))

function kind(id: string, sizes: WidgetSize[]): WidgetManifest {
  return {
    id,
    name: id,
    icon: 'sparkles',
    entry: () => Promise.resolve({} as Component),
    widget: { sizes },
  }
}

/** 单 band 窄网格：420×250 → 4 列 2 行（正好一个 md 铺满，制造「退回流式也塞不下」最省） */
const grid4x2 = (): WidgetGrid => widgetGrid({ x: 0, y: 0, w: 420, h: 250 })
/** 420×396 → 4 列 4 行（越界/相撞的退路还够，用来验「退回流式重排」） */
const grid4x4 = (): WidgetGrid => widgetGrid({ x: 0, y: 0, w: 420, h: 396 })

const item = (id: string, size: WidgetSize, col: number | null, row = 0): PlaceItem => ({
  id,
  size,
  pos: col === null ? null : { col, row },
})

describe('T14(a) 占用判定共用（L-8）', () => {
  it('canPlace 与 placeWidgets 对同一格位的取舍完全一致', () => {
    const g = grid4x4()
    const anchor: PlaceItem = item('anchor', 'md', 0, 0) // 占满 cols0..3 rows0..1
    const anchorCell: CellRect = { col: 0, row: 0, ...SIZE_SPAN.md }
    const sizes: WidgetSize[] = ['sm', 'md']
    for (const size of sizes) {
      const span = SIZE_SPAN[size]
      for (let col = 0; col + span.w <= g.cols; col++) {
        for (let row = 0; row + span.h <= g.rows; row++) {
          const cand: CellRect = { col, row, ...span }
          const ok = canPlace(cand, g, [anchorCell])
          const { placed } = placeWidgets([anchor, item('cand', size, col, row)], g)
          const got = placed.find((p: PlacedWidget) => p.id === 'cand')
          // 「能摆」的唯一口径：canPlace 为真 ⇔ placeWidgets 让它以手动态落在同一格
          expect(got?.manual === true && got.cell.col === col && got.cell.row === row).toBe(ok)
        }
      }
    }
  })

  it('换档放大到被占格位被拒，且拒的依据就是宿主那条 canPlace（与拖拽同源）', () => {
    setActivePinia(createPinia())
    const registry = useWidgetRegistry()
    registry.register(kind('clock', ['sm', 'md']))
    const widgets = useWidgets()
    const res = widgets.add('clock', 'sm')
    if (!res.ok) throw new Error('前置失败')
    const id = res.instance.id

    const g = grid4x4()
    const takenByOthers: CellRect[] = [{ col: 2, row: 0, ...SIZE_SPAN.sm }] // 右邻居占 cols2..3
    const hostLayout = makeHost(g, { [id]: { col: 0, row: 0, ...SIZE_SPAN.sm } }, takenByOthers)
    const warning = vi.fn(() => 1)
    const api = mountGestures(
      id,
      () => hostLayout,
      () => 'sm',
      warning,
    )

    // sm(2列) → md(4列)：目标格位集合与邻居相交
    const expectReject = !canPlace({ col: 0, row: 0, ...SIZE_SPAN.md }, g, takenByOthers)
    expect(expectReject).toBe(true) // 先自证判据确实判「放不下」
    api.stepSize(1)
    expect(warning).toHaveBeenCalledTimes(1) // 拒绝 + 一次短提示（L-3 的口径）
    expect(widgets.byId(id)?.size).toBe('sm') // 保持原档，不落库

    // 邻居让开之后同一动作就通过——证明拒的是占用判定，而不是换档路径自己另立规矩
    hostLayout.takenExcept = () => []
    api.stepSize(1)
    expect(warning).toHaveBeenCalledTimes(1)
    expect(widgets.byId(id)?.size).toBe('md')
  })
})

describe('T14(b) 越界回退（L-7）', () => {
  it('clampIntoGrid 先向内收：只挪坐标、跨度不动、坐标恒为整数', () => {
    const g = grid4x4()
    const clamped = clampIntoGrid({ col: 40, row: -6, w: 2, h: 2 }, g)
    expect(clamped).toEqual({ col: 2, row: 0, w: 2, h: 2 })
    expect(Number.isInteger(clamped.col) && Number.isInteger(clamped.row)).toBe(true)
  })

  it('收完仍与别的件相交：该件退回自动流式重排，不挤压邻居', () => {
    const g = grid4x4()
    const { placed, overflow } = placeWidgets([item('a', 'md', 0, 0), item('b', 'md', 5, 0)], g)
    const b = placed.find((p: PlacedWidget) => p.id === 'b')
    expect(overflow).toEqual([])
    expect(b?.manual).toBe(false) // 回退流式后不再算手动态
    expect(b?.cell).toEqual({ col: 0, row: 2, ...SIZE_SPAN.md }) // 顺位填到下一空行
  })

  it('退回流式也塞不下：溢出条目带原始成因 out-of-range（解 E9 的「为什么没显示」）', () => {
    const g = grid4x2()
    const { placed, overflow } = placeWidgets([item('a', 'md', 0, 0), item('b', 'md', 5, 0)], g)
    expect(placed.map((p: PlacedWidget) => p.id)).toEqual(['a'])
    expect(overflow).toEqual([{ id: 'b', reason: 'out-of-range' }])
  })

  it('手动格位正撞人且无处可退：溢出成因是 collision', () => {
    const g = grid4x2()
    const { placed, overflow } = placeWidgets([item('a', 'md', 0, 0), item('b', 'md', 0, 0)], g)
    expect(placed.map((p: PlacedWidget) => p.id)).toEqual(['a'])
    expect(overflow).toEqual([{ id: 'b', reason: 'collision' }])
  })

  it('向内收成功且空位仍整块空：保留手动态、落在收后的格位（L-7 的正向臂）', () => {
    const g = grid4x4()
    const { placed, overflow } = placeWidgets([item('solo', 'md', 9, 0)], g) // 收到 col=0，无冲突
    const solo = placed.find((p: PlacedWidget) => p.id === 'solo')
    expect(overflow, '收成功的那一格不该进溢出清单').toEqual([])
    expect(solo?.manual).toBe(true)
    expect(solo?.cell).toEqual(clampIntoGrid({ col: 9, row: 0, ...SIZE_SPAN.md }, g))
  })
})

describe('T14(c) 手动态置灰（L-9）', () => {
  const g = grid4x4()

  it('placeWidgets 只对带 pos 的项标 manual:true', () => {
    const { placed } = placeWidgets([item('f', 'sm', null), item('m', 'sm', 0, 0)], g)
    const byId = Object.fromEntries(placed.map((p: PlacedWidget) => [p.id, p]))
    expect(byId['m'].manual).toBe(true)
    expect(byId['f'].manual).toBe(false)
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    useWidgetRegistry().register(kind('clock', ['sm', 'md']))
  })

  it('isManual 给管理面提供置灰依据：有 pos 即真，纯流式为假', () => {
    const widgets = useWidgets()
    const res = widgets.add('clock')
    if (!res.ok) throw new Error('前置失败')
    expect(widgets.isManual(res.instance.id)).toBe(false)
    widgets.setPosition(res.instance.id, { col: 1, row: 1 })
    expect(widgets.isManual(res.instance.id)).toBe(true)
    widgets.releasePosition(res.instance.id) // L-9 的显式出口：撤销手动态回到流式
    expect(widgets.isManual(res.instance.id)).toBe(false)
  })

  it('move() 只重排流式序列：手动件的相对次序与格位纹丝不动', () => {
    const widgets = useWidgets()
    const ids = [0, 1, 2, 3].map(() => {
      const res = widgets.add('clock')
      if (!res.ok) throw new Error('前置失败')
      return res.instance.id
    })
    const [m1, a, b, m2] = ids
    widgets.setPosition(m1, { col: 0, row: 0 })
    widgets.setPosition(m2, { col: 0, row: 2 })

    const before = placeWidgets(
      widgets.renderable.map((i) => ({ id: i.id, size: i.size, pos: i.pos })),
      g,
    )
    widgets.move(b, 0) // 把流式件 b 提到最前，跨过手动件 m1
    const after = placeWidgets(
      widgets.renderable.map((i) => ({ id: i.id, size: i.size, pos: i.pos })),
      g,
    )

    const view = (r: typeof before) => r.placed.map((p: PlacedWidget) => p.id)
    // 手动件次序不变、格位不变
    expect(
      after.placed.filter((p: PlacedWidget) => p.manual).map((p: PlacedWidget) => p.id),
    ).toEqual(before.placed.filter((p: PlacedWidget) => p.manual).map((p: PlacedWidget) => p.id))
    for (const id of [m1, m2]) {
      expect(after.placed.find((p: PlacedWidget) => p.id === id)?.cell).toEqual(
        before.placed.find((p: PlacedWidget) => p.id === id)?.cell,
      )
      expect(widgets.byId(id)?.pos).not.toBeNull()
    }
    // 流式件之间换序了（a/b 谁先落位互换）
    expect(view(before).filter((id: string) => id === a || id === b)).toEqual([a, b])
    expect(view(after).filter((id: string) => id === a || id === b)).toEqual([b, a])
  })

  it('move() 施加在手动件上不改变流式次序（管理面本来就该对它置灰）', () => {
    const widgets = useWidgets()
    const res1 = widgets.add('clock')
    const res2 = widgets.add('clock')
    if (!res1.ok || !res2.ok) throw new Error('前置失败')
    const [m1, flow] = [res1.instance.id, res2.instance.id]
    widgets.setPosition(m1, { col: 0, row: 0 })

    widgets.move(m1, 5) // 越界 toIndex 也只是夹到末尾；手动件的 pos 与流式件的相对序都不该变
    expect(widgets.byId(m1)?.pos).toEqual({ col: 0, row: 0 })
    expect(widgets.renderable.filter((i) => !i.pos).map((i) => i.id)).toEqual([flow])
  })
})

describe('T14(d) 起手区判定（L-10）', () => {
  /* 判定就在 src/kernel/widget/usePlacementGestures.ts 的 startMove 里（INTERACTIVE 选择器），
   * 组件层只是把 pointerdown 转发进来——所以直接喂构造的事件对象即可断言。 */

  beforeEach(() => {
    setActivePinia(createPinia())
    useWidgetRegistry().register(kind('clock', ['sm', 'md']))
  })

  function fakePointer(target: HTMLElement, currentTarget: HTMLElement, button = 0): PointerEvent {
    return {
      target,
      currentTarget,
      button,
      pointerId: 1,
      clientX: 100,
      clientY: 100,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as PointerEvent
  }

  function fixture() {
    const widgets = useWidgets()
    const res = widgets.add('clock', 'sm')
    if (!res.ok) throw new Error('前置失败')
    const id = res.instance.id
    const g = grid4x4()
    const hostLayout = makeHost(g, { [id]: { col: 0, row: 0, ...SIZE_SPAN.sm } }, [])
    const hostSpy = vi.fn(() => hostLayout)
    const warning = vi.fn(() => 1)
    const api = mountGestures(id, hostSpy, () => 'sm', warning)
    return { widgets, id, api, warning, hostSpy }
  }

  it('pointerdown 落在勾选框（input）上：不启动拖拽，pos 保持不变', () => {
    const { widgets, id, api, hostSpy } = fixture()
    const card = document.createElement('div')
    const checkbox = document.createElement('input')
    checkbox.setAttribute('type', 'checkbox')
    card.append(checkbox)

    api.startMove(fakePointer(checkbox, card))

    expect(hostSpy).not.toHaveBeenCalled() // start() 压根没进——占用判定都不会被问
    expect(api.gesture.value).toBeNull()
    expect(widgets.byId(id)?.pos).toBeNull() // 「点勾选」不会把卡片拖走
  })

  it('落在 a / button / [data-widget-interactive] 上同样不启动', () => {
    const { api, hostSpy } = fixture()
    const card = document.createElement('div')
    const knob = document.createElement('div')
    knob.setAttribute('data-widget-interactive', '')
    const interactive = [
      document.createElement('button'),
      Object.assign(document.createElement('a'), { href: '#' }),
      knob,
    ]
    for (const el of interactive) {
      card.replaceChildren(el)
      api.startMove(fakePointer(el, card))
      expect(api.gesture.value).toBeNull()
    }
    expect(hostSpy).not.toHaveBeenCalled()
  })

  it('落在卡片空白处：正常起手，ghost 吸附在整格位上', () => {
    const { api, hostSpy } = fixture()
    const card = document.createElement('div')
    const title = document.createElement('span')
    card.append(title)

    api.startMove(fakePointer(title, card))

    expect(hostSpy).toHaveBeenCalled()
    const g = api.gesture.value
    expect(g, '起手后手势临时态应已建立').not.toBeNull()
    // L-2：ghost 画在吸附后的整格位，不是跟手像素位
    expect(g?.ghost).toMatchObject({ col: 0, row: 0 })
  })

  it('非左键不启动（右键留给 contextmenu）', () => {
    const { api, hostSpy } = fixture()
    const card = document.createElement('div')
    api.startMove(fakePointer(card, card, 2))
    expect(api.gesture.value).toBeNull()
    expect(hostSpy).not.toHaveBeenCalled()
  })
})

describe('T14(e) 落点预览与跟手夹取（L-2 / S-4）', () => {
  /* 预览框必须由宿主**层**来画：卡片自己带跟手 transform、材质又是 overflow-hidden，
   * 画在卡片里的预览会被指针位移带走、越出卡片本体还会被裁——落点等于当前格时它与卡片完全重合，
   * 用户等于没有反馈（2026-10-07 实测的「拖了却回原位」缺陷，见设计文档偏差 28）。
   * 这一组钉**上报出去的数据**（吸附整格位、松手清空、跟手夹取）；渲染位置与裁剪由
   * widget-baseline.spec.ts 的「落点预览」e2e 段钉。 */

  const ORIGIN_X = 100
  const ORIGIN_Y = 100

  beforeEach(() => {
    setActivePinia(createPinia())
    useWidgetRegistry().register(kind('clock', ['sm', 'md']))
  })

  function fakePointer(target: HTMLElement, currentTarget: HTMLElement): PointerEvent {
    return {
      target,
      currentTarget,
      button: 0,
      pointerId: 1,
      clientX: ORIGIN_X,
      clientY: ORIGIN_Y,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as PointerEvent
  }

  /* 手势把 pointermove/up 挂在卡片元素本身上，这里按真实事件派发（happy-dom 的 Event 直接带上坐标即可） */
  function pointerMove(card: HTMLElement, dx: number, dy = 0) {
    card.dispatchEvent(
      Object.assign(new Event('pointermove'), { clientX: ORIGIN_X + dx, clientY: ORIGIN_Y + dy }),
    )
  }
  function pointerUp(card: HTMLElement) {
    card.dispatchEvent(new Event('pointerup'))
  }

  const lastPreview = (host: WidgetHostLayout) => vi.mocked(host.setPreview).mock.calls.at(-1)?.[0]

  /** sm 卡片落在 grid4x4 的 col0/row0（最右列）：cols=4/rows=4、originX=52、originY=24、pitch=92 */
  function fixture(taken: CellRect[] = []) {
    const widgets = useWidgets()
    const res = widgets.add('clock', 'sm')
    if (!res.ok) throw new Error('前置失败')
    const id = res.instance.id
    const g = grid4x4()
    const cell: CellRect = { col: 0, row: 0, ...SIZE_SPAN.sm }
    const hostLayout = makeHost(g, { [id]: cell }, taken)
    const warning = vi.fn(() => 1)
    const api = mountGestures(
      id,
      () => hostLayout,
      () => 'sm',
      warning,
      () => cellRectToPx(cell, g),
    )
    const card = document.createElement('div')
    const title = document.createElement('span')
    card.append(title)
    api.startMove(fakePointer(title, card))
    return { widgets, id, api, warning, hostLayout, cell, card, home: cellRectToPx(cell, g) }
  }

  it('起手即把「吸附后的整格位」交给层——不是卡片自己的像素位', () => {
    const { id, hostLayout, home } = fixture()
    expect(home).toEqual({ x: 236, y: 24, w: 160, h: 160 }) // 52 + (4-0-2)*92 / 24 + 0
    expect(lastPreview(hostLayout)).toEqual({ id, rect: home, valid: true })
  })

  it('不到半格：预览矩形一动不动（卡片照旧跟手）；跨过半格：正好跳一格', () => {
    const { api, hostLayout, card, home } = fixture()

    pointerMove(card, -40) // 40 < 半格 46
    expect(lastPreview(hostLayout)?.rect).toEqual(home)
    expect(api.gesture.value?.offset).toEqual({ x: -40, y: 0 }) // 跟手：卡片确实动了

    pointerMove(card, -60) // 60 ≥ 半格
    expect(lastPreview(hostLayout)?.rect).toEqual({ ...home, x: home.x - (CELL + GUTTER) })
    expect(api.gesture.value?.offset).toEqual({ x: -60, y: 0 })
  })

  it('跟手位移夹在摆放域内：往网格外拖不再外飘，可走距离恰是 (cols-w)·pitch', () => {
    const { api, card } = fixture()

    pointerMove(card, 600) // 已在最右列：往右一点都不动
    expect(api.gesture.value?.offset).toEqual({ x: 0, y: 0 })
    expect(api.gesture.value?.ghost?.col).toBe(0)

    pointerMove(card, -600) // 最左合法列是 col2：横向可走 2·92 = 184
    expect(api.gesture.value?.offset).toEqual({ x: -2 * (CELL + GUTTER), y: 0 })
    expect(api.gesture.value?.ghost?.col).toBe(2)
  })

  it('落定提交：写库 + 清空预览（层上不留幽灵框）', () => {
    const { api, hostLayout, card, widgets, id } = fixture()
    pointerMove(card, -60)
    pointerUp(card)
    expect(lastPreview(hostLayout)).toBeNull()
    expect(api.gesture.value).toBeNull()
    expect(widgets.byId(id)?.pos).toEqual({ col: 1, row: 0 })
  })

  it('落点被拒：预览先标成非法，松手一次短提示 + 不写库 + 同样清空', () => {
    const taken: CellRect[] = [{ col: 1, row: 0, ...SIZE_SPAN.sm }]
    const { api, hostLayout, card, widgets, id, warning } = fixture(taken)

    pointerMove(card, -60) // 目标 col1 被邻居占住
    expect(lastPreview(hostLayout)).toMatchObject({ valid: false }) // 层据此画拒绝态
    expect(api.gesture.value?.valid).toBe(false)

    pointerUp(card)
    expect(warning).toHaveBeenCalledTimes(1) // L-3：拒绝 + 一次短提示
    expect(widgets.byId(id)?.pos).toBeNull()
    expect(lastPreview(hostLayout)).toBeNull()
  })
})

/* ────────── 共用脚手架：宿主布局 mock 与手势组件挂载 ────────── */
/** 与 WidgetLayer.vue 的 provide 同式的宿主替身：canPlaceFor 直连 geometry.canPlace */
function makeHost(
  g: WidgetGrid,
  cells: Record<string, CellRect>,
  taken: CellRect[],
): WidgetHostLayout {
  const layout: WidgetHostLayout = {
    grid: computed(() => g),
    cellOf: (id: string) => cells[id] ?? null,
    takenExcept: () => taken,
    canPlaceFor: (id: string, size: WidgetSize, cell: { col: number; row: number }) =>
      canPlace({ ...cell, ...SIZE_SPAN[size] }, g, layout.takenExcept(id)),
    pinAutoPositions: vi.fn(),
    // 落点预览的上报口：断言「交给层的是吸附格位」就看它（S-4/L-2）
    setPreview: vi.fn(),
  }
  return layout
}

/** usePlacementGestures 依赖 provide/inject + i18n + pinia，借一次性测试组件把上下文搭起来 */
function mountGestures(
  instanceId: string,
  host: () => WidgetHostLayout | undefined,
  size: () => WidgetSize,
  warning: () => number,
  rect: () => Rect = () => ({ x: 0, y: 0, w: 160, h: 160 }),
): GestureApi {
  let api!: GestureApi
  const feedback: FeedbackApi = {
    notify: vi.fn(() => 1),
    success: vi.fn(() => 1),
    error: vi.fn(() => 1),
    warning,
    info: vi.fn(() => 1),
    confirm: vi.fn(async () => true),
  }
  const Probe = defineComponent({
    setup() {
      api = usePlacementGestures({
        instanceId,
        host,
        rect,
        size,
        candidates: () => ['sm', 'md'],
      })
      return () => h('div')
    },
  })
  // provide 只对**后代**可见（同组件 setup 里先 provide 再 inject 拿不到），搭一层壳组件喂上下文
  const Shell = defineComponent({
    setup() {
      provideFeedback(feedback)
      return () => h(Probe)
    },
  })
  mount(Shell)
  return api
}
