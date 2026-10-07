import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, type Component } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import FeedbackHost from '@/shell/FeedbackHost.vue'
import WidgetConsole from '@/components/WidgetConsole.vue'
import WidgetGallery from '@/shell/WidgetGallery.vue'
import WidgetPreview from '@/components/WidgetPreview.vue'
import { previewSlotState } from '@/kernel/widget/previewBudget'
import { activeChannels } from '@/kernel/widget/scheduler'
import { useNotification } from '@/kernel/stores/notification'
import { useSession } from '@/kernel/stores/session'
import { useShellUi } from '@/kernel/stores/shellUi'
import { useVfs } from '@/kernel/stores/vfs'
import { useWidgetRuntime } from '@/kernel/stores/widgetRuntime'
import { useWidgetRegistry, type WidgetManifest } from '@/kernel/stores/widgetRegistry'
import { useWidgets } from '@/kernel/stores/widgets'
import { useWidgetData } from '@/kernel/composables/useWidgetData'
import { TICK_SECOND, useWidgetTick } from '@/kernel/composables/useWidgetTick'

/**
 * 小组件管理台（原「小组件库」）：`WidgetGallery.vue` 现在只是 420px 抽屉壳，
 * 面板本体是这份 `WidgetConsole`，与「小组件中心」应用共用同一实现——
 * 因此行为断言全部打在控制台上，壳只验一条「装的是谁」。
 */

const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))

vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value)
  }),
}))

const Stub: Component = { name: 'Stub', render: () => h('p', '内容') }

function kind(id: string, name: string, extra: Partial<WidgetManifest> = {}): WidgetManifest {
  return {
    id,
    name,
    icon: 'sparkles',
    entry: () => Promise.resolve(Stub),
    widget: { sizes: ['sm', 'md'], defaultSize: 'md' },
    ...extra,
  }
}

function seedKinds() {
  const registry = useWidgetRegistry()
  registry.register(kind('clock', '时钟', { order: 10 }))
  registry.register(
    kind('weather', '天气', { order: 20, singleton: true, widget: { sizes: ['lg'] } }),
  )
  registry.register(
    kind('city', '城市', {
      order: 30,
      config: [
        { key: 'name', type: 'text', label: '城市名', default: '上海' },
        { key: 'zone', type: 'select', label: '时区', options: ['UTC', 'UTC+8'], default: 'UTC+8' },
        { key: 'offset', type: 'number', label: '偏移', default: 0 },
        { key: 'hour12', type: 'boolean', label: '12 小时制', default: false },
      ],
    }),
  )
}

let wrapper: VueWrapper | null = null
let host: HTMLElement | null = null

const norm = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, '')

/** 管理台本体不在抽屉里时不 Teleport，挂进临时 host 以便与 document 上其它测试的残留隔离 */
async function mountConsole() {
  host = document.createElement('div')
  document.body.appendChild(host)
  wrapper = mount(FeedbackHost, {
    slots: { default: () => h(WidgetConsole) },
    attachTo: host,
  })
  await flushPromises()
  await nextTick()
  return wrapper
}

function sectionOf(name: 'search' | 'on-desktop' | 'catalog' | 'data'): HTMLElement {
  const el = host?.querySelector(`[data-widget-section="${name}"]`)
  if (!el) throw new Error(`前置失败：找不到分区「${name}」`)
  return el as HTMLElement
}

function kindRow(kindId: string): HTMLElement {
  const el = host?.querySelector(`[data-widget-kind-row="${kindId}"]`)
  if (!el) throw new Error(`前置失败：找不到目录行「${kindId}」`)
  return el as HTMLElement
}

function instanceRow(instanceId: string): HTMLElement {
  const el = host?.querySelector(`[data-widget-instance-row="${instanceId}"]`)
  if (!el) throw new Error(`前置失败：找不到实例行「${instanceId}」`)
  return el as HTMLElement
}

function buttonIn(scope: ParentNode, text: string): HTMLButtonElement {
  const btn = Array.from(scope.querySelectorAll('button')).find(
    (b) => norm(b.textContent) === norm(text),
  )
  if (!btn) throw new Error(`前置失败：找不到按钮「${text}」`)
  return btn as HTMLButtonElement
}

/** ↑/↓ 是纯图标按钮：没有文字，只能按 aria-label 定位 */
function iconButton(scope: ParentNode, label: string): HTMLButtonElement {
  const btn = scope.querySelector(`button[aria-label="${label}"]`)
  if (!btn) throw new Error(`前置失败：找不到图标按钮「${label}」`)
  return btn as HTMLButtonElement
}

/** 确认框与管理台在同一 host 里：取最后一个同文案按钮（对话框渲染在面板之后） */
function lastButtonByText(text: string): HTMLButtonElement | undefined {
  const all = Array.from(host?.querySelectorAll('button') ?? []).filter(
    (b) => norm(b.textContent) === norm(text),
  )
  return all[all.length - 1]
}

function sizeRadios(scope: ParentNode): string[] {
  const group = scope.querySelector('[role="radiogroup"]')
  if (!group) return []
  return Array.from(group.querySelectorAll('[role="radio"]')).map((r) => norm(r.textContent))
}

/** 打开某行的 ⋯ 菜单并返回条目文案。
 * 目录行点了条目后，菜单在这个环境里会「留在原地」（合成 click 与 OsDropdown 根节点
 * toggle 的时序所致），实例行则正常收起。为对两者都可靠：先读现成的菜单，没开就点开，
 * 万一这一下把它点合上了就再点一下。 */
async function openRowMenu(scope: HTMLElement): Promise<string[]> {
  const trigger = scope.querySelector('button[aria-label="操作"]')
  if (!trigger) throw new Error('前置失败：该行没有「⋯」入口')
  const read = () =>
    Array.from(scope.querySelectorAll('[role="menuitem"]')).map((i) => norm(i.textContent))
  let items = read()
  if (items.length === 0) {
    await click(trigger)
    items = read()
    if (items.length === 0) {
      await click(trigger)
      items = read()
    }
  }
  return items
}

async function click(el: Element) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await flushPromises()
  await nextTick()
}

async function menuClick(scope: HTMLElement, label: string) {
  const item = Array.from(scope.querySelectorAll('[role="menuitem"]')).find(
    (i) => norm(i.textContent) === norm(label),
  )
  if (!item) throw new Error(`前置失败：菜单里没有「${label}」`)
  await click(item)
}

/** 打开某行的 ⋯ 菜单并点其中一项 */
async function pickRowMenu(scope: HTMLElement, label: string) {
  await openRowMenu(scope)
  await menuClick(scope, label)
}

async function addViaChooser(kindId: string, sizeLabel: string) {
  const row = kindRow(kindId)
  await click(buttonIn(row, '添加'))
  await click(buttonIn(row, sizeLabel))
  await click(buttonIn(row, '确定'))
}

/** IntersectionObserver 在 happy-dom 里是空壳（observe 永不回调），并发/沙箱用例需要替身 */
function stubAllInView() {
  stubInView(true)
}

/**
 * 视口替身：`observe` 立刻按 `initial` 回调一次，返回的函数把全体在册目标一次性翻到另一态。
 * 懒挂载的判据（「没进视口的行不挂载」「滑出视口还槽」）在恒 in-view 的替身下**做不出那一屏**，
 * 所以这里必须能把两个态都拨出来。`disconnect` 会摘掉该观察者的登记，卸载后的行不再被广播打到。
 */
function stubInView(initial: boolean): (next: boolean) => void {
  const watched: { owner: unknown; cb: IntersectionObserverCallback; target: Element }[] = []
  const broadcast = (intersecting: boolean) => {
    for (const { owner, cb, target } of watched) {
      cb(
        [{ target, isIntersecting: intersecting }] as unknown as IntersectionObserverEntry[],
        owner as unknown as IntersectionObserver,
      )
    }
  }
  class FakeIntersectionObserver {
    private readonly cb: IntersectionObserverCallback
    constructor(cb: IntersectionObserverCallback) {
      this.cb = cb
    }
    observe(target: Element): void {
      watched.push({ owner: this, cb: this.cb, target })
      this.cb(
        [{ target, isIntersecting: initial }] as unknown as IntersectionObserverEntry[],
        this as unknown as IntersectionObserver,
      )
    }
    unobserve(): void {}
    disconnect(): void {
      for (let i = watched.length - 1; i >= 0; i--) {
        if (watched[i]?.owner === this) watched.splice(i, 1)
      }
    }
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  return broadcast
}

/** 注册一个「挂上就留标记」的件：预览挂载类用例靠标记数真实组件树挂了几棵 */
function registerMarkerKind(id: string, label: string, order: number) {
  useWidgetRegistry().register(
    kind(id, label, {
      order,
      entry: () =>
        Promise.resolve(
          defineComponent({
            name: `Mark${id}`,
            render: () => h('span', { 'data-live-marker': id }),
          }),
        ),
    }),
  )
}

/** 把给定 kind 的 WidgetPreview 并排挂进宿主（不走目录行，只测预览自身的懒挂载与槽位） */
async function mountPreviewHost(
  ids: string[],
): Promise<{ host: HTMLElement; wrapper: VueWrapper }> {
  const Host: Component = {
    name: 'PreviewHost',
    render: () =>
      h(
        'div',
        ids.map((id) => h(WidgetPreview, { kindId: id, size: 'sm' })),
      ),
  }
  const el = document.createElement('div')
  document.body.appendChild(el)
  host = el
  const mounted = mount(Host, { attachTo: el })
  wrapper = mounted
  await flushPromises()
  await nextTick()
  await flushPromises()
  return { host: el, wrapper: mounted }
}

// 收尾必须掐掉落库防抖：`updateConfig` 排的是 300ms setTimeout，而 Pinia 的 action 包装每次被
// 调用都 `setActivePinia(自己那个 pinia)`。本文件每个用例换新 pinia，计时器却挂在**上一个 pinia
// 的 store 实例**上——它在下一个用例中途开火，就把全局 activePinia 拨回了旧实例，此后
// `useWidgets()` 这类「组件外取 store」拿到的是旧 store：操作打在新 store、断言读在旧 store，
// 表现为跨用例的幽灵状态（实测「wgt-city 跑进排序用例」）。并发压测读数：原状 10 路 8 红，
// 掐了之后 14 路 0 红。两个 describe 的清理就此收在一处根级 afterEach。
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  host?.remove()
  host = null
  vi.unstubAllGlobals()
  for (const timer of Object.values(useWidgets().persistTimers)) clearTimeout(timer)
})

describe('WidgetGallery 抽屉壳', () => {
  beforeEach(() => {
    idbStore.clear()
    setActivePinia(createPinia())
    seedKinds()
  })

  it('壳只给 420px 抽屉与标题，内容就是同一份 WidgetConsole（三段齐）', async () => {
    useShellUi().openWidgetGallery()
    wrapper = mount(FeedbackHost, { slots: { default: () => h(WidgetGallery) } })
    await flushPromises()
    await nextTick()

    const drawer = document.body.querySelector('[role="dialog"]') as HTMLElement | null
    expect(drawer).toBeTruthy()
    expect(drawer?.style.width).toBe('420px')
    expect(drawer?.textContent).toContain('小组件库')
    // 合一视图：搜索 / 桌面实例 / 目录 / 数据 四段都在抽屉里
    expect(drawer?.querySelectorAll('[data-widget-section]').length).toBe(4)
    expect(drawer?.textContent).toContain('时钟')
  })
})

describe('WidgetConsole 管理台', () => {
  beforeEach(() => {
    idbStore.clear()
    setActivePinia(createPinia())
    seedKinds()
  })

  it('空桌面给空态（带「去挑一个」行动）；目录列出全部 kind；数据段缺省收起', async () => {
    await mountConsole()
    expect(sectionOf('on-desktop').textContent).toContain('桌面上还没有小组件')
    expect(buttonIn(sectionOf('on-desktop'), '去挑一个')).toBeTruthy()
    expect(sectionOf('catalog').textContent).toContain('时钟')
    expect(sectionOf('catalog').textContent).toContain('天气')
    expect(sectionOf('catalog').textContent).toContain('城市')
    // 数据段缺省收起：面板是 v-show（收起态文本仍在 DOM），先点头条展开再断，不靠残留蒙混
    await click(sectionOf('data').querySelector('button') as Element)
    expect(sectionOf('data').textContent).toContain('没有遗留的数据文件')
  })

  it('搜索按名称收窄目录，清空后全量回来', async () => {
    await mountConsole()
    const input = sectionOf('search').querySelector('input')
    expect(input).toBeTruthy()
    if (!input) return

    input.value = '天气'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    await nextTick()
    expect(sectionOf('catalog').textContent).toContain('天气')
    expect(host?.querySelector('[data-widget-kind-row="clock"]')).toBeNull()

    input.value = ''
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    await nextTick()
    expect(host?.querySelector('[data-widget-kind-row="clock"]')).toBeTruthy()
  })

  it('搜索两段同步收窄：台账跟着货架一起过滤，桌面段搜不到给空态', async () => {
    const added = useWidgets().add('clock')
    if (!added.ok) throw new Error('前置失败')
    await mountConsole()
    expect(host?.querySelector('[data-widget-instance-row]')).toBeTruthy()

    const input = sectionOf('search').querySelector('input')
    expect(input).toBeTruthy()
    if (!input) return

    input.value = '天气'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    await nextTick()
    expect(host?.querySelector('[data-widget-instance-row]')).toBeNull()
    expect(sectionOf('on-desktop').textContent).toContain('没有匹配的小组件')

    input.value = '时钟'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    await nextTick()
    expect(host?.querySelector('[data-widget-instance-row]')).toBeTruthy()
    expect(host?.querySelector('[data-widget-kind-row="clock"]')).toBeTruthy()
    expect(host?.querySelector('[data-widget-kind-row="weather"]')).toBeNull()
  })

  it('空态「去挑一个」把人带到货架段', async () => {
    await mountConsole()
    const proto = Element.prototype as unknown as { scrollIntoView?: () => void }
    const original = proto.scrollIntoView
    const spy = vi.fn()
    proto.scrollIntoView = spy
    try {
      await click(buttonIn(sectionOf('on-desktop'), '去挑一个'))
      expect(spy).toHaveBeenCalled()
    } finally {
      proto.scrollIntoView = original
    }
  })

  it('数据段折叠：无孤儿缺省收起、点头条开合；有孤儿自动亮开', async () => {
    await mountConsole()
    const dataSection = sectionOf('data')
    const panel = dataSection.querySelector('[role="region"]') as HTMLElement
    const header = dataSection.querySelector('button') as Element
    expect(panel.style.display).toBe('none')

    await click(header)
    expect(panel.style.display).not.toBe('none')
    await click(header)
    expect(panel.style.display).toBe('none')

    useVfs().writeFile('/我的数据', 'ghost.json', '{}', 'application/json')
    await flushPromises()
    await nextTick()
    expect(panel.style.display).not.toBe('none')
  })

  it('单档 kind 点「添加」直接摆上桌面（用该档）；singleton 上桌面后按钮变「已添加」且禁用', async () => {
    await mountConsole()
    await click(buttonIn(kindRow('weather'), '添加'))

    const widgets = useWidgets()
    expect(widgets.items).toHaveLength(1)
    expect(widgets.items[0]).toMatchObject({ kindId: 'weather', size: 'lg' })
    expect(sectionOf('on-desktop').textContent).toContain('天气')

    const row = kindRow('weather')
    const added = buttonIn(row, '已添加')
    expect(added.disabled).toBe(true)
  })

  it('多档 kind 的「添加」开尺寸弹层：目录行不再常驻分段控件，确认才落档', async () => {
    await mountConsole()
    const row = kindRow('clock')
    // A-4：尺寸选择收进「添加」的弹层，行本身没有常驻 radiogroup
    expect(row.querySelector('[role="radiogroup"]')).toBeNull()

    await click(buttonIn(row, '添加'))
    const chooser = row.querySelector('[data-widget-size-chooser]')
    expect(chooser).toBeTruthy()
    if (!chooser) return
    expect(sizeRadios(chooser)).toEqual(['小', '中'])
    const checked = Array.from(chooser.querySelectorAll('[role="radio"]')).map((r) =>
      r.getAttribute('aria-checked'),
    )
    expect(checked).toEqual(['false', 'true']) // 缺省预选 defaultSize = md

    await click(buttonIn(chooser, '取消'))
    expect(row.querySelector('[data-widget-size-chooser]')).toBeNull()
    expect(useWidgets().items).toEqual([])

    await addViaChooser('clock', '小')
    expect(useWidgets().items[0]).toMatchObject({ kindId: 'clock', size: 'sm' })
    expect(row.querySelector('[data-widget-size-chooser]')).toBeNull()
  })

  it('实例行的尺寸分段与卡片菜单档位组写同一个 instance.size：点「中」即 setSize', async () => {
    const added = useWidgets().add('clock', 'sm')
    if (!added.ok) throw new Error('前置失败')
    await mountConsole()

    const row = instanceRow(added.instance.id)
    expect(sizeRadios(row)).toEqual(['小', '中'])
    await click(Array.from(row.querySelectorAll('[role="radio"]'))[1])
    expect(useWidgets().byId(added.instance.id)?.size).toBe('md')
  })

  it('配置就地展开：四类控件按 schema 渲染，草稿不落库、「完成」才写回实例', async () => {
    const added = useWidgets().add('city')
    if (!added.ok) throw new Error('前置失败')
    await mountConsole()

    const row = instanceRow(added.instance.id)
    // 收起态：没有配置面板
    expect(row.querySelector('[data-widget-config-panel]')).toBeNull()

    await click(buttonIn(row, '配置'))
    const panel = row.querySelector('[data-widget-config-panel]')
    expect(panel).toBeTruthy()
    if (!panel) return
    expect(panel.querySelector('[role="switch"]')).toBeTruthy()
    expect(panel.querySelector('select')).toBeTruthy()
    expect(panel.querySelector('input[role="spinbutton"]')).toBeTruthy()
    expect(Array.from(panel.querySelectorAll('input')).some((i) => !i.hasAttribute('role'))).toBe(
      true,
    )

    await click(panel.querySelector('[role="switch"]') as Element)
    expect(useWidgets().byId(added.instance.id)?.config).toMatchObject({ hour12: false }) // 还在草稿

    await click(buttonIn(panel, '完成'))
    expect(useWidgets().byId(added.instance.id)?.config).toMatchObject({ hour12: true })
    expect(row.querySelector('[data-widget-config-panel]')).toBeNull() // 完成即收起
  })

  it('排序把手换的是数组下标并落库；手动摆放的实例把手置灰并标「已手动摆放」', async () => {
    const a = useWidgets().add('clock')
    const b = useWidgets().add('clock')
    if (!a.ok || !b.ok) throw new Error('前置失败')
    await mountConsole()
    const widgets = useWidgets()
    const runtime = useWidgetRuntime()

    const rowA = instanceRow(a.instance.id)
    expect(iconButton(rowA, '上移').disabled).toBe(true) // 首位没有上移
    await click(iconButton(rowA, '下移'))
    expect(widgets.renderable.map((i) => i.id)).toEqual([b.instance.id, a.instance.id])

    // 手动摆放：把手按 store 里的 pos 置灰（脱离流式序列，L-9）
    widgets.setPosition(b.instance.id, { col: 0, row: 0 })
    // 「已手动摆放」这行小字来自 WidgetLayer 写回的运行态 placement，单测里没有那一层，照其口径补一次
    runtime.syncPlacement({ [b.instance.id]: { visible: true, overflow: null, manual: true } }, 0)
    await flushPromises()
    await nextTick()
    const rowB = instanceRow(b.instance.id)
    expect(iconButton(rowB, '上移').disabled).toBe(true)
    expect(iconButton(rowB, '下移').disabled).toBe(true)
    expect(rowB.textContent).toContain('已手动摆放')
    expect(iconButton(instanceRow(a.instance.id), '上移').disabled).toBe(false)
  })

  it('实例行 ⋯ 菜单按处境拼条目：手动态多一项「退回自动摆放」，移除经确认生效', async () => {
    const added = useWidgets().add('clock')
    if (!added.ok) throw new Error('前置失败')
    useWidgets().setPosition(added.instance.id, { col: 1, row: 2 })
    await mountConsole()

    const row = instanceRow(added.instance.id)
    expect(await openRowMenu(row)).toEqual(['退回自动摆放', '移除'])
    await menuClick(row, '退回自动摆放')
    expect(useWidgets().byId(added.instance.id)?.pos).toBeNull()

    expect(await openRowMenu(row)).toEqual(['移除'])
    await menuClick(row, '移除')
    await click(lastButtonByText('确定') as Element)
    expect(useWidgets().items).toEqual([])
  })

  it('目录 ⋯ 停用：实例留台账、标「已禁用」、桌面不渲染；再启用即恢复', async () => {
    const added = useWidgets().add('clock')
    if (!added.ok) throw new Error('前置失败')
    await mountConsole()
    const widgets = useWidgets()

    const row = kindRow('clock')
    expect(await openRowMenu(row)).toEqual(['停用', '卸载'])
    await menuClick(row, '停用')

    expect(widgets.kindState('clock').enabled).toBe(false)
    expect(widgets.renderable).toHaveLength(1) // 实例与配置都还在
    expect(widgets.visible).toEqual([]) // 只是桌面不渲染
    expect(instanceRow(added.instance.id).textContent).toContain('已禁用')

    await pickRowMenu(kindRow('clock'), '启用')
    expect(widgets.kindState('clock').enabled).toBe(true)
    expect(widgets.visible).toHaveLength(1)
  })

  it('目录 ⋯ 卸载经确认连实例一起摘；「安装」回架但实例不复活；已卸载点添加会先装回', async () => {
    useWidgets().add('clock')
    await mountConsole()
    const widgets = useWidgets()

    const row = kindRow('clock')
    await pickRowMenu(row, '卸载')
    await click(lastButtonByText('确定') as Element)
    expect(widgets.items).toEqual([])
    expect(widgets.kindState('clock')).toEqual({ installed: false, enabled: false })
    expect(host?.querySelector('[data-widget-instance-row]')).toBeNull()

    await pickRowMenu(kindRow('clock'), '安装')
    expect(widgets.kindState('clock')).toEqual({ installed: true, enabled: true })
    expect(widgets.items).toEqual([]) // 装回的是货架，不是实例

    // 未安装的 kind 一步就能加上：openChooser 先装回再摆实例
    widgets.uninstall('weather')
    await click(buttonIn(kindRow('weather'), '添加'))
    expect(widgets.kindState('weather').installed).toBe(true)
    expect(widgets.items.map((i) => i.kindId)).toContain('weather')
  })

  it('无权限 kind 走灰态行：只告知「需要什么角色」，添加禁用、无预览、无生命周期菜单', async () => {
    useWidgetRegistry().register(
      kind('secret', '机密', { order: 40, permissions: ['widget:secret'] }),
    )
    useSession().setUser('guest')
    await mountConsole()

    const row = kindRow('secret')
    expect(row.textContent).toContain('需要「管理员」权限')
    expect(buttonIn(row, '添加').disabled).toBe(true)
    expect(row.querySelector('[data-widget-preview]')).toBeNull() // 灰态行不渲染真实预览
    expect(row.querySelector('button[aria-label="操作"]')).toBeNull()
    // 其余无权限声明的 kind 不受影响
    expect(sectionOf('catalog').textContent).toContain('时钟')
  })

  it('预览沙箱零副作用：真实件挂进目录行也不写 VFS/IDB、不注册心跳（T6）', async () => {
    stubAllInView()
    // DEV 护栏用 console.assert(false, …) 标注「沙箱内写数据被挡下」；收进 spy 既消掉 stderr
    // 又能把它变成显式断言——每次 write/patch 都必须撞护栏一次。
    const guard = vi.spyOn(console, 'assert').mockImplementation(() => {})
    const QuietProbe: Component = defineComponent({
      name: 'QuietProbe',
      setup() {
        const store = useWidgetData<{ text: string }[]>('tasks', () => [{ text: '样例' }])
        useWidgetTick(TICK_SECOND)
        store.write([{ text: '想写盘' }]) // 沙箱里必须是 no-op，且要撞护栏
        store.patch([])
        const shown = JSON.stringify(store.data.value)
        return () => h('p', { 'data-quiet': shown }, shown)
      },
    })
    useWidgetRegistry().register(
      kind('quiet', '安静件', {
        order: 50,
        data: { key: 'tasks', scope: 'shared' },
        entry: () => Promise.resolve(QuietProbe),
      }),
    )
    const vfs = useVfs()
    vfs.ready = true // 真实上下文里这一位会立刻补写默认值——沙箱必须不写
    await mountConsole()

    const preview = kindRow('quiet').querySelector('[data-widget-preview]')
    expect(preview).toBeTruthy()
    const rendered = preview?.querySelector('[data-quiet]')
    expect(rendered).toBeTruthy() // 真实组件确实挂了进来（抢到并发槽）
    expect(rendered?.textContent).toContain('样例') // 读的是样例/fallback，不是真实 VFS

    expect(vfs.byPath('/我的数据/tasks.json')).toBeUndefined()
    expect(idbStore.has('fs-v1')).toBe(false) // 连持久化请求都没发过
    expect(activeChannels()).not.toContain(TICK_SECOND) // 预览不注册心跳
    // write/patch 各撞一次 DEV 护栏：证明「挡下」不是「静默失败」而是有意的沙箱守卫
    expect(guard).toHaveBeenCalledTimes(2)
    expect(
      guard.mock.calls.every(
        ([first, msg]) => first === false && String(msg).includes('预览沙箱内不得写真实数据'),
      ),
    ).toBe(true)
    guard.mockRestore()
  })

  it('预览全局并发上限 4：同屏 6 个只挂 4 个真实组件，卸载后槽全部归还（§9 T8）', async () => {
    stubAllInView()
    const ids = Array.from({ length: 6 }, (_, i) => `pk${i + 1}`)
    ids.forEach((id, i) => registerMarkerKind(id, `并发${i + 1}`, i + 1))
    const { host: el, wrapper: mounted } = await mountPreviewHost(ids)

    const state = previewSlotState()
    expect(state.live).toBeLessThanOrEqual(4)
    expect(state.live).toBe(4)
    expect(state.queued).toBe(2)
    expect(el.querySelectorAll('[data-live-marker]')).toHaveLength(4)

    mounted.unmount()
    wrapper = null
    expect(previewSlotState()).toEqual({ live: 0, queued: 0 }) // 还槽干净，不给后续测试留尾巴
  })

  /**
   * 上一条把视口恒置为「在屏」，量的只有槽位预算——「没进视口的行不挂载」这一整半此前没有腿
   * （§4.8 的懒挂载判据就是这一句）。这里用可翻转的视口替身把三态都做一次：视口外一槽都不申请
   * （预算 4 个槽全空着也不挂）、进视口才挂、滑出视口把槽还回去。三态各自是方向相反的 mutant：
   * 恒挂（`v-if` 去掉 inView 门控）红在第一态，恒不挂红在第二态，不还槽红在第三态。
   */
  it('预览懒挂载：视口外的行一槽都不申请、一棵都不挂，进视口才挂、滑出即还槽（§9 T8）', async () => {
    const setInView = stubInView(false)
    const ids = ['pv1', 'pv2', 'pv3']
    ids.forEach((id, i) => registerMarkerKind(id, `懒挂载${i + 1}`, 60 + i))
    const { host: el } = await mountPreviewHost(ids)

    expect(previewSlotState(), '视口外不该申请槽位').toEqual({ live: 0, queued: 0 })
    expect(el.querySelectorAll('[data-live-marker]')).toHaveLength(0)

    setInView(true)
    await nextTick()
    await flushPromises()
    expect(previewSlotState(), '3 行都进视口且预算够，应全挂').toEqual({ live: 3, queued: 0 })
    expect(el.querySelectorAll('[data-live-marker]')).toHaveLength(3)

    setInView(false)
    await nextTick()
    await flushPromises()
    expect(previewSlotState(), '滑出视口必须把槽还回预算').toEqual({ live: 0, queued: 0 })
    expect(el.querySelectorAll('[data-live-marker]')).toHaveLength(0)
  })

  it('数据段只盘点无人引用的件数据；一键清理只动孤儿，引用中的与区外文件不碰', async () => {
    // 引用权威 = 在册实例的 manifest.data 经 widgetDataPath 解出的路径（删件不删数据 ⇒ 这里给出口）
    useWidgetRegistry().register(
      kind('note', '便签', { order: 40, data: { key: 'notes', scope: 'shared' } }),
    )
    const added = useWidgets().add('note')
    if (!added.ok) throw new Error('前置失败')
    const vfs = useVfs()
    const DATA = '/我的数据'
    vfs.writeFile(DATA, 'notes.json', '[]', 'application/json') // 在册实例引用中
    vfs.writeFile(DATA, 'ghost.json', '{}', 'application/json') // 孤儿：再无 kind/实例引用
    vfs.writeFile(DATA, 'readme.txt', 'hi') // 非 JSON：不在盘点范围
    vfs.writeFile('/我的文件', 'keep.json', '{}') // 数据区之外

    await mountConsole()
    const dataSection = sectionOf('data')
    expect(dataSection.textContent).toContain('ghost.json')
    expect(dataSection.textContent).not.toContain('notes.json')
    expect(dataSection.textContent).not.toContain('readme.txt')
    expect(dataSection.textContent).not.toContain('keep.json')

    await click(dataSection.querySelector('[data-widget-clear-orphans]') as Element)

    expect(vfs.byPath('/我的数据/ghost.json')).toBeUndefined() // 进回收站，不是抹掉
    expect(vfs.byPath('/回收站/ghost.json')).toBeTruthy()
    expect(vfs.byPath('/我的数据/notes.json')).toBeTruthy() // 引用中的不动
    expect(vfs.byPath('/我的数据/readme.txt')).toBeTruthy()
    expect(vfs.byPath('/我的文件/keep.json')).toBeTruthy()
    expect(sectionOf('data').textContent).toContain('没有遗留的数据文件')
    expect(useNotification().items[0]?.title).toBe('已清除 1 个遗留数据文件')
  })
})
