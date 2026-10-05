import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsDescriptions, type DescriptionItem } from '@/ui'

const items: DescriptionItem[] = [
  { key: 'name', label: '名称', value: 'report.xlsx' },
  { key: 'size', label: '大小', value: '1.2 MB' },
]

describe('OsDescriptions', () => {
  it('按 items 渲染 dt/dd 键值对', () => {
    const w = mount(OsDescriptions, { props: { items } })
    expect(w.findAll('dt').map((d) => d.text())).toEqual(['名称', '大小'])
    expect(w.findAll('dd').map((d) => d.text())).toEqual(['report.xlsx', '1.2 MB'])
  })

  it('title 渲染为小标题', () => {
    const w = mount(OsDescriptions, { props: { items, title: '详情' } })
    expect(w.find('h4').text()).toBe('详情')
  })

  it('slot 字段自定义值（逃生口），缺省命名规则 value-<key>', () => {
    const w = mount(OsDescriptions, {
      props: { items: [{ ...items[0], slot: 'custom' }, items[1]] },
      slots: { custom: '<b class="vv">插槽值</b>', 'value-size': '<em>em 值</em>' },
    })
    expect(w.find('.vv').text()).toBe('插槽值')
    expect(w.findAll('dd')[1].text()).toBe('em 值')
  })

  it('column=2 时宽窗口两列、窄窗口回落单列', () => {
    expect(mount(OsDescriptions, { props: { items } }).find('dl').classes()).not.toContain(
      'w-mid:grid-cols-2',
    )
    expect(
      mount(OsDescriptions, { props: { items, column: 2 } })
        .find('dl')
        .classes(),
    ).toContain('w-mid:grid-cols-2')
  })
})
