import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import ContextMenu from '@/shell/ContextMenu.vue'
import { useShellUi, type ContextMenuItem } from '@/kernel/stores/shellUi'

/**
 * 壳层右键菜单宿主：单例通道 + 一处呈现。
 * 桌面空白处与小组件卡片都只负责推条目，渲染/关闭/定位全在这里。
 */

function item(overrides: Partial<ContextMenuItem> = {}): ContextMenuItem {
  return { key: 'a', label: '动作', run: vi.fn(), ...overrides }
}

let wrapper: VueWrapper | null = null

function mountMenu() {
  wrapper = mount(ContextMenu, { attachTo: document.body })
  return wrapper
}

function enter(target: EventTarget) {
  target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
}

describe('ContextMenu 壳层右键菜单宿主', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('没有菜单态时不渲染任何东西', () => {
    const w = mountMenu()
    expect(w.find('ul').exists()).toBe(false)
  })

  it('按条目渲染：勾 / 分隔线 / 危险色调', async () => {
    useShellUi().openContextMenu(40, 60, [
      item({ key: 's1', label: '小', checked: true }),
      item({ key: 's2', label: '中' }),
      item({ key: 'manage', label: '管理小组件…', separatorBefore: true }),
      item({ key: 'remove', label: '移除', danger: true }),
    ])
    const w = mountMenu()
    await nextTick()

    const rows = w.findAll('li')
    // 分隔线本身是一个 li，因此 4 条动作 + 1 条分隔线
    expect(rows).toHaveLength(5)
    // 分隔线只做视觉分组：aria-hidden，且不写 role（覆写成 presentation 会让 ul 的 list 语义被 axe 判违规）
    expect(rows[2].attributes('aria-hidden')).toBe('true')

    const buttons = w.findAll('button')
    expect(buttons).toHaveLength(4)
    expect(buttons.map((b) => b.text())).toEqual(['小', '中', '管理小组件…', '移除'])
    expect(buttons[0].find('svg').exists()).toBe(true) // 勾只出在当前档
    expect(buttons[1].find('svg').exists()).toBe(false)
    expect(buttons[2].find('svg').exists()).toBe(false)
    expect(buttons[3].classes().join(' ')).toContain('text-danger-text')
    expect(buttons[2].classes().join(' ')).not.toContain('text-danger-text')
  })

  it('位置按视口夹取，不把菜单顶出右下角', async () => {
    useShellUi().openContextMenu(window.innerWidth - 4, window.innerHeight - 4, [item()])
    const w = mountMenu()
    await nextTick()

    const style = w.get('ul').attributes('style') ?? ''
    const left = Number(/left:\s*(-?\d+)px/.exec(style)?.[1])
    const top = Number(/top:\s*(-?\d+)px/.exec(style)?.[1])
    expect(left).toBeLessThan(window.innerWidth)
    expect(top).toBeLessThan(window.innerHeight)
  })

  it('点条目先收起菜单再执行动作', async () => {
    const run = vi.fn()
    useShellUi().openContextMenu(0, 0, [item({ run })])
    const w = mountMenu()
    await nextTick()

    await w.get('button').trigger('click')

    expect(run).toHaveBeenCalledTimes(1)
    expect(useShellUi().contextMenu).toBeNull()
  })

  it('外点与 Esc 关闭；菜单内的按下不关', async () => {
    const ui = useShellUi()
    ui.openContextMenu(0, 0, [item()])
    const w = mountMenu()
    await nextTick()

    enter(w.get('button').element) // 菜单内按下：指针事件在菜单里，不该关
    expect(ui.contextMenu).not.toBeNull()

    enter(document.body)
    expect(ui.contextMenu).toBeNull()

    ui.openContextMenu(0, 0, [item()])
    await nextTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(ui.contextMenu).toBeNull()
  })

  it('开壳层其它浮层时菜单让位（同一时刻只有一个）', () => {
    const ui = useShellUi()
    ui.openContextMenu(0, 0, [item()])
    ui.openWidgetGallery()
    expect(ui.contextMenu).toBeNull()

    ui.openContextMenu(0, 0, [item()])
    ui.closeOverlays()
    expect(ui.contextMenu).toBeNull()
  })
})
