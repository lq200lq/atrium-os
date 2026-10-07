import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import TopBar from '@/shell/TopBar.vue'
import { useAppRegistry } from '@/kernel/stores/appRegistry'
import { useShellUi } from '@/kernel/stores/shellUi'
import { useWindowManager } from '@/kernel/stores/windowManager'
import { manifest as settingsManifest } from '@/apps/settings/manifest'
import { manifest as docsManifest } from '@/apps/docs-center/manifest'

/**
 * 顶栏菜单精简（开源标准轮）：原来七個菜单全是无 onClick 的死按钮，
 * 收敛为「视图 / 帮助」两个真有动作的 OsDropdown；其余菜单语义保留在
 * 组件陈列的菜单 demo（locale 键不删）。
 */

let wrapper: VueWrapper | null = null

function mountTopBar() {
  wrapper = mount(TopBar, { attachTo: document.body })
  return wrapper
}

async function openMenu(w: VueWrapper, name: string) {
  const trigger = w.findAll('nav button').find((b) => b.text() === name)
  expect(trigger, `顶栏应有「${name}」菜单入口`).toBeTruthy()
  await trigger!.trigger('click')
  await nextTick()
}

function menuItems() {
  return Array.from(document.querySelectorAll('[role="menuitem"]'))
}

describe('TopBar 顶栏菜单', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // appRegistry 由 main.ts 装配，单测自行注册用到的两个真实 manifest
    const registry = useAppRegistry()
    registry.register(settingsManifest)
    registry.register(docsManifest)
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('只留视图/帮助两个入口，五个死菜单不再渲染', async () => {
    const w = mountTopBar()
    const labels = w.findAll('nav button').map((b) => b.text())
    expect(labels).toEqual(['视图', '帮助'])
    const navText = w.find('nav').text()
    for (const gone of ['工作台', '文件', '编辑', '应用', '窗口']) {
      expect(navText, `死菜单「${gone}」应已下线`).not.toContain(gone)
    }
  })

  it('入口带 menu 语义（aria-haspopup + aria-expanded 跟随开合）', async () => {
    const w = mountTopBar()
    const help = w.findAll('nav button')[1]
    expect(help.attributes('aria-haspopup')).toBe('menu')
    expect(help.attributes('aria-expanded')).toBe('false')
    await help.trigger('click')
    await nextTick()
    expect(help.attributes('aria-expanded')).toBe('true')
  })

  it('视图 → 显示桌面切换，勾选态进菜单文案', async () => {
    const w = mountTopBar()
    const ui = useShellUi()
    expect(ui.desktopRevealed).toBe(false)

    await openMenu(w, '视图')
    expect(menuItems().map((el) => el.textContent)).toEqual(['显示桌面'])
    menuItems()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(ui.desktopRevealed).toBe(true)

    await openMenu(w, '视图')
    expect(menuItems()[0].textContent).toContain('✓ 显示桌面')
  })

  it('帮助 → 关于本系统：开设置窗口并带 system 段落点', async () => {
    const w = mountTopBar()
    await openMenu(w, '帮助')
    expect(menuItems().map((el) => el.textContent)).toEqual(['关于本系统', '文档中心'])

    menuItems()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    const wm = useWindowManager()
    const win = wm.windows.find((x) => x.appId === 'settings')
    expect(win, '设置窗口应被打开').toBeTruthy()
    expect((win!.payload as { section?: string } | undefined)?.section).toBe('system')
  })

  it('帮助 → 文档中心：打开 docs-center', async () => {
    const w = mountTopBar()
    await openMenu(w, '帮助')
    menuItems()[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(useWindowManager().windows.some((x) => x.appId === 'docs-center')).toBe(true)
  })
})
