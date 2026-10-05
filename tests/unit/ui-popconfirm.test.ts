import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { OsPopconfirm, type Placement } from '@/ui'
import { placementClass } from '@/ui/internal/placement'

const ALL_PLACEMENTS: Placement[] = [
  'top',
  'top-start',
  'top-end',
  'bottom',
  'bottom-start',
  'bottom-end',
  'left',
  'left-start',
  'left-end',
  'right',
  'right-start',
  'right-end',
]

function setup(props: Record<string, unknown> = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const w = mount(OsPopconfirm, {
    props,
    slots: { default: '<button>触发</button>' },
    attachTo: host,
  })
  return { w, host }
}

let current: { w: VueWrapper; host: HTMLElement } | null = null

function open(props: Record<string, unknown> = {}) {
  current = setup(props)
  return current
}

afterEach(() => {
  current?.w.unmount()
  current?.host.remove()
  current = null
})

describe('OsPopconfirm 开合行为', () => {
  it('点击触发钮打开浮层（role=dialog），再点关闭', async () => {
    const { w } = open({ title: '确认删除？' })
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    await w.find('button').trigger('click')
    const dialog = w.find('[role="dialog"]')
    expect(dialog.exists()).toBe(true)
    expect(dialog.attributes('aria-label')).toBe('确认删除？')
    await w.find('button').trigger('click')
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it('打开时焦点进入确认按钮，Esc 关闭后焦点回到触发元素', async () => {
    const { w } = open({ title: '确认删除？' })
    await w.find('button').trigger('click')
    const ok = w.findAll('[role="dialog"] button').at(-1)!
    expect(document.activeElement).toBe(ok.element)
    expect(ok.text()).toContain('确定')
    await w.find('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    await w.vm.$nextTick()
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(w.element)
  })

  it('点外部关闭；点浮层内部不关闭', async () => {
    const { w } = open({ title: 't' })
    await w.find('button').trigger('click')
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[role="dialog"]').exists()).toBe(false)

    await w.find('button').trigger('click')
    w.find('[role="dialog"]').element.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[role="dialog"]').exists()).toBe(true)
  })

  it('外点关闭只收起，不把焦点从用户点中的元素抢回', async () => {
    const { w } = open({ title: 't' })
    await w.find('button').trigger('click')
    // 模拟真实点击：pointerdown 之前浏览器已把焦点交给被点元素（这里在浮层外另放一个）
    const elsewhere = document.createElement('button')
    document.body.appendChild(elsewhere)
    elsewhere.focus()
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(elsewhere)
    elsewhere.remove()
  })

  it('卸载必须解绑 document 上的 pointerdown 监听', async () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const { w, host } = setup({ title: 't' })
    await w.find('button').trigger('click')
    w.unmount()
    expect(removeSpy.mock.calls.some((c) => c[0] === 'pointerdown')).toBe(true)
    removeSpy.mockRestore()
    host.remove()
  })

  it('disabled 时点击不打开', async () => {
    const { w } = open({ title: 't', disabled: true })
    await w.find('button').trigger('click')
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })
})

describe('OsPopconfirm 内容与事件', () => {
  it('description prop 与 description 插槽；okText/cancelText 覆盖 i18n 缺省', async () => {
    const { w } = open({ title: 't', description: '说明文本', okText: '好的', cancelText: '算了' })
    await w.find('button').trigger('click')
    expect(w.text()).toContain('说明文本')
    const buttons = w.findAll('[role="dialog"] button')
    expect(buttons[0]!.text()).toBe('算了')
    expect(buttons[1]!.text()).toBe('好的')
  })

  it('确认派发 confirm 并关闭；取消派发 cancel 并关闭', async () => {
    const { w } = open({ title: 't' })
    await w.find('button').trigger('click')
    await w.findAll('[role="dialog"] button')[1]!.trigger('click')
    expect(w.emitted('confirm')).toBeTruthy()
    expect(w.find('[role="dialog"]').exists()).toBe(false)

    await w.find('button').trigger('click')
    await w.findAll('[role="dialog"] button')[0]!.trigger('click')
    expect(w.emitted('cancel')).toBeTruthy()
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it.each(ALL_PLACEMENTS)('placement=%s 使用定位原语静态类串', async (p) => {
    const { w } = open({ title: 't', placement: p })
    await w.find('button').trigger('click')
    const cls = w.find('[role="dialog"]').classes()
    for (const token of placementClass(p).split(/\s+/)) {
      expect(cls, `placement=${p}`).toContain(token)
    }
  })
})

describe('placement 原语（S10）', () => {
  it('12 方位全覆盖且返回源内静态类串', () => {
    for (const p of ALL_PLACEMENTS) {
      const cls = placementClass(p)
      expect(cls.split(/\s+/).length, p).toBeGreaterThan(1)
      // 只允许刻度档偏移（2xs），不得含运行时拼接痕迹
      expect(cls, p).toMatch(/(^|\s)m[tblr]-2xs(\s|$)/)
    }
  })

  it('偏移只取间距刻度 2xs，无裸 px', () => {
    for (const p of ALL_PLACEMENTS) {
      expect(placementClass(p)).not.toMatch(/\d+px/)
    }
  })

  it('层级：浮层取 z-panel 刻度档', async () => {
    const { w } = open({ title: 't' })
    await w.find('button').trigger('click')
    expect(w.find('[role="dialog"]').classes()).toContain('z-panel')
  })
})
