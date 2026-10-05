import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsAvatar, type Size } from '@/ui'
import { expectSizeContract } from './contract-helpers'

describe('OsAvatar', () => {
  it('无 src / text 时回退默认 user 图标', () => {
    const w = mount(OsAvatar)
    expect(w.find('svg').exists()).toBe(true)
    expect(w.find('img').exists()).toBe(false)
  })

  it('src 优先渲染图片，加载失败回退图标', async () => {
    const w = mount(OsAvatar, { props: { src: '/a.png', alt: '头像' } })
    expect(w.find('img').attributes('src')).toBe('/a.png')
    await w.find('img').trigger('error')
    expect(w.find('img').exists()).toBe(false)
    expect(w.find('svg').exists()).toBe(true)
  })

  it('text 显示首字母，优先于图标回退', () => {
    const w = mount(OsAvatar, { props: { text: 'QD' } })
    expect(w.text()).toBe('QD')
    expect(w.find('svg').exists()).toBe(false)
  })

  it.each(['sm', 'md', 'lg'] as Size[])('size=%s 走控件高度刻度', (size) => {
    const w = mount(OsAvatar, { props: { size } })
    expectSizeContract(w.element, size)
    expect(w.classes()).toContain('aspect-square')
  })

  it('恒为圆形（rounded-full 是头像专用档）', () => {
    expect(mount(OsAvatar).classes()).toContain('rounded-full')
  })
})
