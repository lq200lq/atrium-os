import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsBadge, type BadgeStatus } from '@/ui'

describe('OsBadge', () => {
  it('数量阈值显示', () => {
    expect(
      mount(OsBadge, { props: { count: 0 } })
        .find('span')
        .exists(),
    ).toBe(false)
    expect(mount(OsBadge, { props: { count: 5 } }).text()).toBe('5')
    expect(mount(OsBadge, { props: { count: 12 } }).text()).toBe('9+')
  })

  it('max 可配，超出显示上限加号', () => {
    expect(mount(OsBadge, { props: { count: 40, max: 99 } }).text()).toBe('40')
    expect(mount(OsBadge, { props: { count: 100, max: 99 } }).text()).toBe('99+')
  })

  it('计数型用 danger seed 实心底', () => {
    expect(mount(OsBadge, { props: { count: 3 } }).classes()).toContain('bg-danger')
  })

  it('dot 型渲染状态点，不依赖 count', () => {
    const w = mount(OsBadge, { props: { dot: true, status: 'success' } })
    const dot = w.find('span > span')
    expect(dot.exists()).toBe(true)
    expect(dot.classes()).toContain('bg-success')
    expect(w.text()).toBe('')
  })

  it.each([
    ['default', 'bg-ink-mute'],
    ['error', 'bg-danger'],
    ['warning', 'bg-warning'],
    ['success', 'bg-success'],
    ['info', 'bg-info'],
  ] as [BadgeStatus, string][])('dot 型 %s 取 %s 语义色', (status, cls) => {
    expect(
      mount(OsBadge, { props: { dot: true, status } })
        .find('span > span')
        .classes(),
    ).toContain(cls)
  })

  it('dot 型可带插槽文案', () => {
    const w = mount(OsBadge, {
      props: { dot: true, status: 'warning' },
      slots: { default: '待处理' },
    })
    expect(w.text()).toBe('待处理')
    expect(w.find('span > span').classes()).toContain('bg-warning')
  })
})
