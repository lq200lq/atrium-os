import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { OsDropdown, type MenuItem } from '@/ui'
import { placementClass } from '@/ui/internal/placement'
import { classTokens } from './contract-helpers'

const items: MenuItem[] = [
  { key: 'new-dir', label: '新建目录', icon: 'folder' },
  { key: 'new-doc', label: '新建文档' },
  { key: 'delete', label: '删除', danger: true },
  { key: 'share', label: '共享', disabled: true },
]

let current: { w: VueWrapper; host: HTMLElement } | null = null

function open(props: Record<string, unknown> = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const w = mount(OsDropdown, {
    props: { items, ...props },
    slots: { default: '<button>触发</button>' },
    attachTo: host,
  })
  current = { w, host }
  return current
}

afterEach(() => {
  current?.w.unmount()
  current?.host.remove()
  current = null
})

describe('OsDropdown 开合行为（复用 OsMenu，不重抄键盘逻辑）', () => {
  it('点击触发打开浮层：group 容器内是 role=menu，层级与定位走刻度/原语', async () => {
    const { w } = open()
    expect(w.find('[role="menu"]').exists()).toBe(false)
    await w.find('button').trigger('click')
    const group = w.find('[role="group"]')
    expect(group.exists()).toBe(true)
    expect(group.attributes('aria-label')).toBe('选项菜单')
    expect(group.find('[role="menu"]').exists()).toBe(true)
    expect(group.findAll('[role="menuitem"]')).toHaveLength(4)
    const cls = classTokens(group.element)
    expect(cls).toContain('z-panel')
    for (const token of placementClass('bottom-start').split(/\s+/)) {
      expect(cls).toContain(token)
    }
  })

  it('打开时焦点进入菜单首项；选中后关闭且焦点回到触发元素', async () => {
    const { w } = open()
    await w.find('button').trigger('click')
    await w.vm.$nextTick()
    const first = w.findAll('[role="menuitem"]')[0]
    expect(document.activeElement).toBe(first.element)
    // 委托 OsMenu 的键盘语义：方向键移动由菜单自身处理
    await first.trigger('keydown', { key: 'ArrowDown' })
    expect(w.findAll('[role="menuitem"]')[1].attributes('tabindex')).toBe('0')
    await w.findAll('[role="menuitem"]')[1].trigger('keydown', { key: 'Enter' })
    expect(w.emitted('click')?.[0]).toEqual(['new-doc'])
    expect(w.find('[role="menu"]').exists()).toBe(false)
    await w.vm.$nextTick()
    expect(document.activeElement).toBe(w.find('button').element)
  })

  it('Esc 关闭浮层并把焦点还给触发元素', async () => {
    const { w } = open()
    await w.find('button').trigger('click')
    await w.vm.$nextTick()
    await w.find('[role="menuitem"]').trigger('keydown', { key: 'Escape' })
    expect(w.find('[role="menu"]').exists()).toBe(false)
    await w.vm.$nextTick()
    expect(document.activeElement).toBe(w.find('button').element)
  })

  it('点外部关闭；点浮层内部不关闭（同 OsPopconfirm 的 pointerdown 模式）', async () => {
    const { w } = open()
    await w.find('button').trigger('click')
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[role="menu"]').exists()).toBe(false)

    await w.find('button').trigger('click')
    w.find('[role="group"]').element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[role="menu"]').exists()).toBe(true)
  })

  it('卸载必须解绑 document 上的 pointerdown 监听', async () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const { w, host } = open()
    await w.find('button').trigger('click')
    w.unmount()
    expect(removeSpy.mock.calls.some((c) => c[0] === 'pointerdown')).toBe(true)
    removeSpy.mockRestore()
    host.remove()
  })

  it('disabled 时点击不打开，且整体走 is-disabled', async () => {
    const { w } = open({ disabled: true })
    await w.find('button').trigger('click')
    expect(w.find('[role="menu"]').exists()).toBe(false)
    expect(classTokens(w.element)).toContain('is-disabled')
  })

  it('hover 触发：移入打开但不抢焦点，移出关闭', async () => {
    const { w } = open({ trigger: 'hover' })
    await w.trigger('mouseenter')
    expect(w.find('[role="menu"]').exists()).toBe(true)
    await w.vm.$nextTick()
    expect(w.element.contains(document.activeElement)).toBe(false)
    await w.trigger('mouseleave')
    expect(w.find('[role="menu"]').exists()).toBe(false)
  })

  it('v-model:open 受控：外部写 true 即打开并聚焦首项', async () => {
    const { w } = open({ open: true, 'onUpdate:open': () => {} })
    await w.vm.$nextTick()
    expect(w.find('[role="menu"]').exists()).toBe(true)
    await w.vm.$nextTick()
    expect(document.activeElement).toBe(w.findAll('[role="menuitem"]')[0].element)
  })

  it('placement 透传给 OsMenu 浮层（placement 原语类串）', async () => {
    const { w } = open({ placement: 'top-end' })
    await w.find('button').trigger('click')
    const cls = classTokens(w.find('[role="group"]').element)
    for (const token of placementClass('top-end').split(/\s+/)) expect(cls).toContain(token)
  })
})
