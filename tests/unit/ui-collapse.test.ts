import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsCollapse, type CollapseItem } from '@/ui'

const items: CollapseItem[] = [
  { key: 'a', header: '甲' },
  { key: 'b', header: '乙' },
]

const headers = (w: ReturnType<typeof mount>) => w.findAll('button[aria-expanded]')

describe('OsCollapse', () => {
  it('非受控：点击 header 展开，aria-expanded 与面板可见性同步', async () => {
    const w = mount(OsCollapse, { props: { items } })
    expect(headers(w).map((h) => h.attributes('aria-expanded'))).toEqual(['false', 'false'])
    await headers(w)[0].trigger('click')
    expect(headers(w)[0].attributes('aria-expanded')).toBe('true')
    const panel = w.find('[role="region"]')
    expect(panel.attributes('style') ?? '').not.toContain('display: none')
  })

  it('aria-controls 指向对应面板 id', () => {
    const w = mount(OsCollapse, { props: { items } })
    const controls = headers(w)[0].attributes('aria-controls')
    expect(w.find(`#${controls}`).attributes('aria-labelledby')).toBe(
      headers(w)[0].attributes('id'),
    )
  })

  it('multiple（默认）允许同时展开多项', async () => {
    const w = mount(OsCollapse, { props: { items } })
    await headers(w)[0].trigger('click')
    await headers(w)[1].trigger('click')
    expect(headers(w).map((h) => h.attributes('aria-expanded'))).toEqual(['true', 'true'])
  })

  it('accordion 下展开新项自动收起旧项', async () => {
    const w = mount(OsCollapse, { props: { items, accordion: true } })
    await headers(w)[0].trigger('click')
    await headers(w)[1].trigger('click')
    expect(headers(w).map((h) => h.attributes('aria-expanded'))).toEqual(['false', 'true'])
  })

  it('受控：modelValue 决定展开态，交互只派发 update:modelValue', async () => {
    const w = mount(OsCollapse, { props: { items, modelValue: ['a'] } })
    expect(headers(w).map((h) => h.attributes('aria-expanded'))).toEqual(['true', 'false'])
    await headers(w)[1].trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([['a', 'b']])
  })

  it('panel-<key> 插槽注入面板内容，header-<key> 可覆盖标题', () => {
    const w = mount(OsCollapse, {
      props: { items, modelValue: ['a'] },
      slots: { 'panel-a': '<p class="pp">面板甲</p>', 'header-b': '<em class="hh">乙改</em>' },
    })
    expect(w.find('.pp').exists()).toBe(true)
    expect(w.find('.hh').text()).toBe('乙改')
  })
})
