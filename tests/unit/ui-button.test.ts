import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsButton, type Size } from '@/ui'
import { expectSizeContract } from './contract-helpers'

describe('OsButton', () => {
  it('渲染插槽与 disabled', () => {
    const wrapper = mount(OsButton, { slots: { default: '按钮' }, props: { disabled: true } })
    expect(wrapper.text()).toBe('按钮')
    expect(wrapper.attributes('disabled')).toBeDefined()
  })

  it('variant 决定样式', () => {
    const primary = mount(OsButton, { props: { variant: 'primary' } })
    const danger = mount(OsButton, { props: { variant: 'danger' } })
    expect(primary.classes()).toContain('bg-accent-fill')
    // danger 文字必须走 -text 语义档：seed 直接作文字色对表面只有 3.67:1（AA 需 4.5:1）
    expect(danger.classes()).toContain('text-danger-text')
    expect(danger.classes()).not.toContain('text-danger')
  })

  it.each(['sm', 'md', 'lg'] as Size[])('%s 档取对应控件高度刻度', (size) => {
    expectSizeContract(mount(OsButton, { props: { size } }).element, size)
  })

  it('默认档位为 md，lg 可显式指定', () => {
    expect(mount(OsButton).classes()).toContain('h-control')
    expect(mount(OsButton, { props: { size: 'lg' } }).classes()).toContain('h-control-lg')
  })

  it('loading 态禁用并内联状态图标，高度档不随之变化', () => {
    const w = mount(OsButton, { props: { loading: true, size: 'sm' }, slots: { default: '提交' } })
    expect(w.attributes('disabled')).toBeDefined()
    expect(w.attributes('aria-busy')).toBe('true')
    expect(w.classes()).toContain('disabled:is-disabled')
    // 无布局位移：文案仍在，高度档仍是 sm 那一格
    expect(w.text()).toContain('提交')
    expect(w.classes()).toContain('h-control-sm')
    expect(w.find('svg.animate-spin').exists()).toBe(true)
  })

  it('非 loading 不渲染状态图标', () => {
    expect(
      mount(OsButton, { props: { loading: false } })
        .find('svg')
        .exists(),
    ).toBe(false)
  })
})
