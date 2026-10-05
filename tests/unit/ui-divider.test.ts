import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsDivider } from '@/ui'

describe('OsDivider', () => {
  it('默认横向：separator 语义 + 全宽横线', () => {
    const w = mount(OsDivider)
    expect(w.attributes('role')).toBe('separator')
    expect(w.attributes('aria-orientation')).toBe('horizontal')
    expect(w.classes()).toEqual(expect.arrayContaining(['h-px', 'w-full', 'bg-line']))
  })

  it('vertical 改为纵向自拉伸，aria-orientation 同步', () => {
    const w = mount(OsDivider, { props: { vertical: true } })
    expect(w.attributes('aria-orientation')).toBe('vertical')
    expect(w.classes()).toEqual(expect.arrayContaining(['w-px', 'self-stretch']))
  })

  it('dashed 用虚线边框而非实心底', () => {
    expect(mount(OsDivider, { props: { dashed: true } }).classes()).toEqual(
      expect.arrayContaining(['border-t', 'border-dashed', 'border-line']),
    )
    expect(mount(OsDivider, { props: { dashed: true, vertical: true } }).classes()).toContain(
      'border-l',
    )
  })

  it('default 插槽渲染居中文案，两侧补线段', () => {
    const w = mount(OsDivider, { slots: { default: '或' } })
    expect(w.text()).toBe('或')
    expect(w.findAll('span.h-px')).toHaveLength(2)
  })
})
