import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { h, nextTick, type Component } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import FeedbackHost from '@/shell/FeedbackHost.vue'
import WidgetLayer from '@/shell/WidgetLayer.vue'
import { useShellUi } from '@/kernel/stores/shellUi'
import { useWidgetRegistry, type WidgetManifest } from '@/kernel/stores/widgetRegistry'
import { useWidgetRuntime } from '@/kernel/stores/widgetRuntime'
import { useWidgets } from '@/kernel/stores/widgets'
import { BAND_COLS } from '@/kernel/widget/geometry'
import { i18n } from '@/i18n'

/**
 * 桌面小组件宿主层：几何与摆放的唯一权威。
 * 覆盖三件事——落位结果同步进运行态、窄视口收层与 resize 回挂、
 * 溢出出口的三动作（换小一档 / 定位 / 移除）与配置弹层。
 */

const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))
vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value)
  }),
}))

const Stub: Component = { name: 'Stub', render: () => h('p', '小组件内容') }
const t = (key: string, params?: Record<string, unknown>) =>
  params ? (i18n.global.t(key, params) as string) : (i18n.global.t(key) as string)

function kind(id: string, extra: Partial<WidgetManifest> = {}): WidgetManifest {
  return {
    id,
    name: id,
    icon: 'sparkles',
    entry: () => Promise.resolve(Stub),
    widget: { sizes: ['sm', 'md', 'lg'], defaultSize: 'md' },
    ...extra,
  }
}

let wrapper: VueWrapper | null = null

async function mountLayer() {
  wrapper = mount(FeedbackHost, {
    attachTo: document.body,
    slots: { default: () => h(WidgetLayer) },
  })
  await flushPromises()
  await nextTick()
  return wrapper
}

function setViewport(width: number, height = 768) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true })
  window.dispatchEvent(new Event('resize'))
}

describe('WidgetLayer', () => {
  beforeEach(() => {
    idbStore.clear()
    setActivePinia(createPinia())
    setViewport(1024, 768)
    wrapper = null
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    // 落库防抖挂在 store 上：不清会跨用例开火，把 activePinia 拨回旧实例（§9 单测地基教训）
    for (const timer of Object.values(useWidgets().persistTimers)) clearTimeout(timer)
    vi.useRealTimers()
  })

  it('摆放结果同步进运行态：可见实例落 visible、bandsUsed 与 usedRect 同源写入', async () => {
    useWidgetRegistry().register(kind('demo-kind'))
    const added = useWidgets().add('demo-kind')
    if (!added.ok) throw new Error('前置失败：实例未建立')

    const w = await mountLayer()
    expect(w.find('[data-widget-layer]').exists()).toBe(true)

    const runtime = useWidgetRuntime()
    const entry = runtime.placementOf(added.instance.id)
    expect(entry.visible).toBe(true)
    expect(runtime.bandsUsed).toBeGreaterThanOrEqual(1)
    expect(runtime.usedRect).not.toBeNull()

    // 卡片确实渲染出来了（异步 entry 落地）
    await flushPromises()
    expect(w.text()).toContain('小组件内容')
  })

  it('窄视口收整层，resize 到宽视口回挂', async () => {
    useWidgetRegistry().register(kind('demo-kind'))
    useWidgets().add('demo-kind')

    setViewport(300) // cols=3 < BAND_COLS(4)
    const w = await mountLayer()
    expect(w.find('[data-widget-layer]').exists()).toBe(false)

    setViewport(1024)
    await nextTick()
    expect(w.find('[data-widget-layer]').exists()).toBe(true)
    expect(BAND_COLS).toBe(4)
  })

  it('溢出出口：计数、展开、换小一档、定位到管理台、移除', async () => {
    const registry = useWidgetRegistry()
    registry.register(kind('demo-kind'))
    const widgets = useWidgets()
    // 塞到放不下为止（溢出判定由层挂载后的 syncPlacement 写入运行态）
    let guard = 0
    const runtime = useWidgetRuntime()
    while (guard++ < 40) widgets.add('demo-kind')

    const w = await mountLayer()
    expect(runtime.overflowEntries.length, '前置：确实产生了溢出').toBeGreaterThan(0)
    const toggle = w.get('[data-widget-layer] button[aria-controls="widget-overflow-list"]')
    expect(toggle.text()).toContain(String(runtime.overflowEntries.length))
    expect(toggle.attributes('aria-expanded')).toBe('false')

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    const rows = w.findAll('[data-widget-overflow-entry]')
    expect(rows.length).toBe(runtime.overflowEntries.length)

    // 定位到管理台（取当行的 id，后续动作会改变行序）
    const ui = useShellUi()
    const row0Id = rows[0].attributes('data-instance-id')!
    const locate = rows[0].get(`button[aria-label="${t('widgets.overflowLocate')}"]`)
    await locate.trigger('click')
    expect(ui.widgetGalleryOpen).toBe(true)
    expect(ui.focusInstanceId).toBe(row0Id)

    // 换小一档：首行实例当前是 md，缩一档后 size 必变（sizes 首档为 sm，按钮按 canShrink 显隐）
    const before = widgets.byId(row0Id)!.size
    const shrinkBtn = w
      .findAll('[data-widget-overflow-entry]')
      .find((r) => r.attributes('data-instance-id') === row0Id)!
      .findAll('button')
      .find((b) => b.text() === t('widgets.shrinkOne'))
    expect(shrinkBtn, '非最小档应有换小一档出口').toBeTruthy()
    await shrinkBtn!.trigger('click')
    expect(widgets.byId(row0Id)!.size).not.toBe(before)

    // 移除：取仍在清单里的最后一行，实例与行一起消失
    const rowsAfter = w.findAll('[data-widget-overflow-entry]')
    const victimId = rowsAfter[rowsAfter.length - 1].attributes('data-instance-id')!
    const countBefore = widgets.items.length
    const remove = rowsAfter[rowsAfter.length - 1].get(
      `button[aria-label="${t('widgets.remove')}"]`,
    )
    await remove.trigger('click')
    expect(widgets.items.length).toBe(countBefore - 1)
    expect(widgets.byId(victimId)).toBeUndefined()
  })

  it('配置弹层：openWidgetConfig 出 dialog，点背景关闭', async () => {
    useWidgetRegistry().register(kind('demo-kind', { name: '演示件' }))
    const added = useWidgets().add('demo-kind')
    if (!added.ok) throw new Error('前置失败：实例未建立')
    const w = await mountLayer()

    const ui = useShellUi()
    ui.openWidgetConfig(added.instance.id)
    await nextTick()

    const dialog = w.get('[data-widget-config-dialog]')
    expect(dialog.find('[role="dialog"]').exists()).toBe(true)
    expect(dialog.find('[role="dialog"]').attributes('aria-modal')).toBe('true')
    expect(dialog.find('[role="dialog"]').attributes('aria-label')).toContain('演示件')

    // 点背景（.self：只在自身命中时关）
    await dialog.trigger('pointerdown')
    expect(ui.configInstanceId).toBeNull()
  })
})
