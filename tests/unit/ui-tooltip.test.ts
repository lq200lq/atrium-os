import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsTooltip } from '@/ui'

const mountTip = (placement?: 'top' | 'bottom' | 'left' | 'right') =>
  mount(OsTooltip, {
    props: placement ? { text: '提示语', placement } : { text: '提示语' },
    slots: { default: '<button>触发</button>' },
  })

describe('OsTooltip', () => {
  it('悬停显示、移开隐藏提示文本', async () => {
    const w = mountTip()
    expect(w.text()).not.toContain('提示语')
    await w.find('span').trigger('mouseenter')
    expect(w.find('[role="tooltip"]').text()).toBe('提示语')
    await w.find('span').trigger('mouseleave')
    expect(w.find('[role="tooltip"]').exists()).toBe(false)
  })

  it('键盘聚焦同样显示提示', async () => {
    const w = mountTip()
    await w.find('span').trigger('focusin')
    expect(w.find('[role="tooltip"]').exists()).toBe(true)
    await w.find('span').trigger('focusout')
    expect(w.find('[role="tooltip"]').exists()).toBe(false)
  })

  it('缺省贴上方', async () => {
    const w = mountTip()
    await w.find('span').trigger('mouseenter')
    const cls = w.find('[role="tooltip"]').classes()
    expect(cls).toContain('bottom-full')
    expect(cls).toContain('-translate-x-1/2')
  })

  it.each([
    ['top', 'bottom-full'],
    ['bottom', 'top-full'],
    ['left', 'right-full'],
    ['right', 'left-full'],
  ] as const)('%s 向贴 %s 一侧', async (placement, anchor) => {
    const w = mountTip(placement)
    await w.find('span').trigger('mouseenter')
    expect(w.find('[role="tooltip"]').classes()).toContain(anchor)
  })

  it('左右两向改为纵向居中', async () => {
    const w = mountTip('left')
    await w.find('span').trigger('mouseenter')
    const cls = w.find('[role="tooltip"]').classes()
    expect(cls).toContain('top-1/2')
    expect(cls).toContain('-translate-y-1/2')
  })
})
