import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, onScopeDispose, type Component } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import FeedbackHost from '@/shell/FeedbackHost.vue'
import WidgetFrame from '@/shell/WidgetFrame.vue'
import { useWidgetContext } from '@/kernel/composables/useWidgetContext'
import { useWidgetDrill } from '@/kernel/composables/useWidgetDrill'
import { useAppRegistry } from '@/kernel/stores/appRegistry'
import { useShellUi, type ContextMenuItem } from '@/kernel/stores/shellUi'
import { useWidgetRegistry, type WidgetManifest } from '@/kernel/stores/widgetRegistry'
import { useWidgetRuntime } from '@/kernel/stores/widgetRuntime'
import { useWidgets } from '@/kernel/stores/widgets'
import { useWindowManager } from '@/kernel/stores/windowManager'

const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))

vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value)
  }),
}))

/** 异步组件的落地物：loader resolve 之后要有能渲染的东西，否则断言只能停在「有节点」 */
const Stub: Component = { name: 'Stub', render: () => h('p', '小组件内容') }

/** 件侧探针：证明「宿主与件解析同一份下钻目标」与「实例摘掉后可空读不炸」 */
const Probe: Component = defineComponent({
  name: 'Probe',
  setup() {
    const ctx = useWidgetContext()
    const drill = useWidgetDrill()
    return () =>
      h('div', [
        h('span', { 'data-inst': ctx.instance.value ? 'live' : 'null' }, '探针内容'),
        h('button', { onClick: () => drill.open() }, '件内下钻'),
      ])
  },
})

const RECT = { x: 100, y: 100, w: 344, h: 160 }

function kind(id: string, extra: Partial<WidgetManifest> = {}): WidgetManifest {
  return {
    id,
    name: id,
    icon: 'sparkles',
    entry: () => Promise.resolve(Stub),
    widget: { sizes: ['md'] },
    ...extra,
  }
}

function registerApp(id: string) {
  useAppRegistry().register({
    id,
    name: id,
    icon: 'sparkles',
    window: { w: 400, h: 300 },
    entry: () => Promise.resolve(Stub),
  })
}

async function mountFrame(manifest: WidgetManifest, size?: 'sm' | 'md' | 'lg') {
  useWidgetRegistry().register(manifest)
  const widgets = useWidgets()
  const added = widgets.add(manifest.id, size)
  if (!added.ok) throw new Error('前置失败：实例未建立')
  const wrapper = mount(FeedbackHost, {
    slots: { default: () => h(WidgetFrame, { instanceId: added.instance.id, rect: RECT }) },
  })
  await flushPromises()
  await nextTick()
  return wrapper
}

function menuItems(): ContextMenuItem[] {
  return useShellUi().contextMenu?.items ?? []
}

function itemByKey(key: string): ContextMenuItem {
  const item = menuItems().find((i) => i.key === key)
  if (!item) throw new Error(`前置失败：菜单里没有「${key}」`)
  return item
}

async function openMenu(wrapper: VueWrapper) {
  await wrapper.get('section').trigger('contextmenu', { clientX: 120, clientY: 240 })
  return useShellUi().contextMenu
}

describe('WidgetFrame 宿主壳', () => {
  beforeEach(() => {
    idbStore.clear()
    setActivePinia(createPinia())
  })

  it('渲染小组件内容、尺寸位与可访问名', async () => {
    const wrapper = await mountFrame(
      kind('plain', { name: '纯展示', nameKey: 'widgets.names.todos' }),
    )
    const section = wrapper.get('section')

    expect(section.text()).toContain('小组件内容')
    expect(section.attributes('style')).toContain('left: 100px')
    expect(section.attributes('style')).toContain('width: 344px')
    // nameKey 命中语言包（走 useAppName），widgets.names.* 是唯一权威：待办件叫「今日待办」
    expect(section.attributes('aria-label')).toBe('今日待办')
    expect(section.classes()).toContain('cq-widget')
    expect(section.attributes('data-widget-size')).toBe('md')
    expect(section.attributes('data-widget-placed')).toBe('auto')
  })

  it('卡片表面不放宿主自绘浮标：改尺寸只走菜单档位组（多档才给，S-1 只认声明过的档）', async () => {
    const multi = await mountFrame(kind('two', { widget: { sizes: ['sm', 'md'] } }), 'sm')
    // 移除钮与拖角手柄都不在卡片上（2026-10-07 摘）：右键菜单是这两件事的唯一入口
    expect(multi.get('section').findAll('button')).toHaveLength(0)
    await openMenu(multi)
    expect(menuItems().map((i) => i.key)).toEqual(['size:sm', 'size:md', 'manage', 'remove'])
    await multi.unmount()

    const single = await mountFrame(kind('one'))
    expect(single.get('section').findAll('button')).toHaveLength(0)
    await openMenu(single)
    expect(menuItems().map((i) => i.key)).toEqual(['manage', 'remove'])
  })

  it('展示型 + 可访问的下钻目标：整块点击带 payload 打开目标应用（H-1/E14）', async () => {
    registerApp('settings')
    const open = vi.spyOn(useWindowManager(), 'open')
    const wrapper = await mountFrame(
      kind('jump', {
        openAppId: { appId: 'settings', payloadFor: (ctx) => ({ size: ctx.size }) },
      }),
    )

    await wrapper.get('section').trigger('click')

    expect(open).toHaveBeenCalledWith('settings', { size: 'md' })
  })

  it('宿主整块点击与件内 useWidgetDrill 解析出同一个落点（单权威）', async () => {
    registerApp('settings')
    const open = vi.spyOn(useWindowManager(), 'open')
    const wrapper = await mountFrame(
      kind('probe', {
        entry: () => Promise.resolve(Probe),
        openAppId: { appId: 'settings', payloadFor: (ctx) => ({ picked: ctx.selected }) },
      }),
    )
    // 件里选中的那条内容要随 payload 一起带进应用（U7）
    useWidgets().setSelected('wgt-probe', 'd-7')
    await flushPromises()
    await nextTick()

    await wrapper.get('button').trigger('click')
    expect(open).toHaveBeenCalledWith('settings', { picked: 'd-7' })

    // 宿主菜单里的「打开应用」跑的是同一个 payload，两处不会给出两种落点
    await openMenu(wrapper)
    itemByKey('open-app').run()
    expect(open).toHaveBeenLastCalledWith('settings', { picked: 'd-7' })
  })

  it('交互型不接管整块点击，但 Enter/菜单下钻仍在', async () => {
    registerApp('settings')
    const open = vi.spyOn(useWindowManager(), 'open')
    const wrapper = await mountFrame(kind('touchy', { interactive: true, openAppId: 'settings' }))

    await wrapper.get('section').trigger('click')
    expect(open).not.toHaveBeenCalled()

    await openMenu(wrapper)
    expect(menuItems().map((i) => i.label)).toContain('打开应用')
    itemByKey('open-app').run()
    expect(open).toHaveBeenCalledWith('settings', undefined)
  })

  it('目标应用不可访问时，整块点击与「打开应用」菜单项一起消失（§4.5 第 2 项）', async () => {
    const open = vi.spyOn(useWindowManager(), 'open')
    // openAppId 指向没注册过的 app：os.can 判 false
    const wrapper = await mountFrame(kind('ghostly', { openAppId: '从没注册过的应用' }))

    await wrapper.get('section').trigger('click')
    expect(open).not.toHaveBeenCalled()
    await openMenu(wrapper)
    expect(menuItems().map((i) => i.label)).not.toContain('打开应用')
  })

  it('卡片菜单按固定顺序拼装：尺寸组→配置→立即刷新→打开应用→退回自动摆放→管理→移除', async () => {
    registerApp('settings')
    const wrapper = await mountFrame(
      kind('full', {
        widget: { sizes: ['sm', 'md'], defaultSize: 'sm' },
        config: [{ key: 'x', type: 'boolean', label: '开关', default: false }],
        refresh: 'minute',
        openAppId: 'settings',
      }),
      'sm',
    )
    useWidgets().setPosition('wgt-full', { col: 1, row: 0 })

    const menu = await openMenu(wrapper)
    expect(menu?.x).toBe(120)
    expect(menu?.y).toBe(240)
    expect(menuItems().map((i) => i.label)).toEqual([
      '小',
      '中',
      '配置',
      '立即刷新',
      '打开应用',
      '退回自动摆放',
      '管理小组件…',
      '移除',
    ])
    expect(itemByKey('size:sm').checked).toBe(true)
    expect(itemByKey('size:md').checked).toBe(false)
    // 分隔线划出各组：尺寸组之后每项各起一段，「移除」贴着「管理」不留线
    expect(itemByKey('config').separatorBefore).toBe(true)
    expect(itemByKey('manage').separatorBefore).toBe(true)
    expect(itemByKey('remove').separatorBefore).toBeFalsy()
    expect(itemByKey('remove').danger).toBe(true)
  })

  it('单档无配置无下钻的 kind 只剩「管理 + 移除」两项', async () => {
    const wrapper = await mountFrame(kind('plain'))
    await openMenu(wrapper)
    expect(menuItems().map((i) => i.label)).toEqual(['管理小组件…', '移除'])
  })

  it('菜单动作各就各位：换尺寸即改实例、刷新打到运行态、管理开小组件中心、退回自动清 pos', async () => {
    registerApp('settings')
    const runtime = useWidgetRuntime()
    const open = vi.spyOn(useWindowManager(), 'open')
    const wrapper = await mountFrame(
      kind('doer', { widget: { sizes: ['sm', 'md'] }, refresh: 'minute' }),
      'sm',
    )
    useWidgets().setPosition('wgt-doer', { col: 2, row: 1 })
    await openMenu(wrapper)

    itemByKey('size:md').run()
    expect(useWidgets().byId('wgt-doer')?.size).toBe('md')
    itemByKey('refresh').run()
    expect(runtime.refreshCount('wgt-doer')).toBe(1)
    itemByKey('release').run()
    expect(useWidgets().byId('wgt-doer')?.pos).toBeNull()
    itemByKey('manage').run()
    expect(open).toHaveBeenCalledWith('widget-center', undefined)
  })

  it('移除入口经确认框后才摘掉实例', async () => {
    const wrapper = await mountFrame(kind('plain'))
    const widgets = useWidgets()

    // 卡片上没有「移除」浮标了：唯一的鼠标入口是右键菜单那一项
    await openMenu(wrapper)
    itemByKey('remove').run()
    await flushPromises()
    await nextTick()

    // 确认框出现，实例还在
    const confirm = wrapper.findAll('button').find((b) => b.text() === '确定')
    expect(confirm).toBeTruthy()
    expect(widgets.items).toHaveLength(1)

    await confirm?.trigger('click')
    await flushPromises()
    await nextTick()

    expect(widgets.items).toEqual([])
  })

  it('确认框里点取消则保留实例', async () => {
    const wrapper = await mountFrame(kind('plain'))
    const widgets = useWidgets()

    await openMenu(wrapper)
    itemByKey('remove').run()
    await flushPromises()
    await nextTick()

    const cancel = wrapper.findAll('button').find((b) => b.text() === '取消')
    await cancel?.trigger('click')
    await flushPromises()
    await nextTick()

    expect(widgets.items).toHaveLength(1)
  })

  it('实例被摘掉的收尾窗口：件读到的 instance 是 null 而不是抛错，卡片整体降级不炸', async () => {
    const disposed: { instance: string } = { instance: '未触发' }
    const TeardownProbe: Component = defineComponent({
      name: 'TeardownProbe',
      setup() {
        const ctx = useWidgetContext()
        // 收尾 flush 里件还会摸一次上下文：此刻实例已不在表里，必须给 null（可空契约）
        onScopeDispose(() => {
          disposed.instance = ctx.instance.value === null ? 'null' : '非空'
        })
        return () => h('p', '收尾探针内容')
      },
    })
    const wrapper = await mountFrame(kind('probe', { entry: () => Promise.resolve(TeardownProbe) }))
    expect(wrapper.text()).toContain('收尾探针内容')

    // 确认移除后还有异步在飞（落库/退订），此时实例已被摘——旧口径在这里整壳崩掉
    useWidgets().remove('wgt-probe')
    await flushPromises()
    await nextTick()

    expect(disposed.instance).toBe('null')
    // 卡片壳还在、内容整体卸干净：不抛错，也不留半张坏卡
    expect(wrapper.find('section').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('收尾探针内容')
  })
})
