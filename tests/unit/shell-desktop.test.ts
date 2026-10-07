import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import Desktop from '@/shell/Desktop.vue'
import { useAppRegistry, type AppManifest } from '@/kernel/stores/appRegistry'
import { useShellUi } from '@/kernel/stores/shellUi'
import { useTheme } from '@/kernel/stores/theme'
import { useWidgetRuntime } from '@/kernel/stores/widgetRuntime'
import { useWindowManager } from '@/kernel/stores/windowManager'
import { i18n } from '@/i18n'

const t = (key: string) => i18n.global.t(key) as string
const stubEntry = () => Promise.resolve({} as Component)

let wrapper: VueWrapper

function contextItems() {
  return useShellUi().contextMenu?.items ?? []
}

describe('Desktop 桌面', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // happy-dom 无 ResizeObserver：标语量宽的观察器在测试里用空实现
    if (!('ResizeObserver' in globalThis)) {
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe() {}
          unobserve() {}
          disconnect() {}
        },
      )
    }
    useAppRegistry().register({
      id: 'app-center',
      name: '应用中心',
      icon: 'sparkles',
      window: { w: 400, h: 300 },
      entry: stubEntry,
    } as AppManifest)
    wrapper = mount(Desktop, { attachTo: document.body })
  })

  it('壁纸 class 跟随主题，标语默认可见', () => {
    const theme = useTheme()
    expect(wrapper.get('div.absolute').classes()).toContain(theme.wallpaper)
    expect(wrapper.get('[data-desktop-slogan]').classes()).toContain('opacity-100')
  })

  it('bandsUsed ≥ 2 时标语让位（opacity-0）', async () => {
    useWidgetRuntime().syncPlacement({}, 2, null)
    await nextTick()
    await nextTick()
    expect(wrapper.get('[data-desktop-slogan]').classes()).toContain('opacity-0')
  })

  it('右键走壳层菜单单例通道：四个条目，各自动作接线', async () => {
    const ui = useShellUi()
    const wm = useWindowManager()
    const theme = useTheme()
    wm.blur = vi.fn()
    wm.cascadeAll = vi.fn()
    theme.cycleWallpaper = vi.fn()

    await wrapper.get('div.absolute').trigger('contextmenu', { clientX: 10, clientY: 20 })
    expect(ui.contextMenu).not.toBeNull()
    // 快照后再跑：第一个动作（开管理台）会顺手收掉右键菜单，属单例通道的既定行为
    const items = [...contextItems()]
    expect(items.map((i) => i.key)).toEqual([
      'context.widgets',
      'context.cascade',
      'context.wallpaper',
      'context.appCenter',
    ])
    expect(ui.contextMenu?.x).toBe(10)

    const byKey = (k: string) => {
      const item = items.find((i) => i.key === k)
      expect(item, `菜单应有「${k}」`).toBeTruthy()
      return item!
    }
    byKey('context.widgets').run()
    expect(ui.widgetGalleryOpen).toBe(true)
    byKey('context.cascade').run()
    expect(wm.cascadeAll).toHaveBeenCalled()
    byKey('context.wallpaper').run()
    expect(theme.cycleWallpaper).toHaveBeenCalled()
    byKey('context.appCenter').run()
    expect(useWindowManager().windows.some((x) => x.appId === 'app-center')).toBe(true)
    // 单例通道：开新菜单会覆盖，这里直接清掉避免跨用例残留
    ui.contextMenu = null
  })

  it('点桌面：失焦窗口 + 速览态还原', async () => {
    const wm = useWindowManager()
    const ui = useShellUi()
    wm.blur = vi.fn()
    ui.setDesktopRevealed(true)

    await wrapper.get('div.absolute').trigger('pointerdown')
    expect(wm.blur).toHaveBeenCalled()
    expect(ui.desktopRevealed).toBe(false)
  })

  it('标语文案走 i18n（brand.slogan/tagline）', () => {
    const el = wrapper.get('[data-desktop-slogan]')
    expect(el.text()).toContain(t('brand.slogan'))
    expect(el.text()).toContain(t('brand.tagline'))
  })
})
