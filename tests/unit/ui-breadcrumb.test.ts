import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsBreadcrumb, type BreadcrumbItem } from '@/ui'

const items: BreadcrumbItem[] = [
  { key: 'work', label: '工作台', icon: 'boxes' },
  { key: 'project', label: '项目资料' },
  { key: 'tech', label: '技术文档' },
  { key: 'file', label: '接口约定.md' },
]

describe('OsBreadcrumb 基本渲染', () => {
  it('nav 容器带 i18n 无障碍名；每个层级一个可点元素，末项不可点且 aria-current=page', () => {
    const w = mount(OsBreadcrumb, { props: { items } })
    const nav = w.find('nav')
    expect(nav.exists()).toBe(true)
    expect(nav.attributes('aria-label')).toBe('路径导航')
    const crumbs = w.findAll('button')
    expect(crumbs).toHaveLength(4)
    expect(crumbs[0].attributes('disabled')).toBeUndefined()
    expect(crumbs[3].attributes('disabled')).toBeDefined()
    expect(crumbs[3].attributes('aria-current')).toBe('page')
    expect(crumbs[3].attributes('aria-disabled')).toBe('true')
  })

  it('分隔符独立 span 渲染（aria-hidden），separator prop 可覆写', () => {
    const w = mount(OsBreadcrumb, { props: { items } })
    const seps = w.findAll('span[aria-hidden="true"]')
    expect(seps).toHaveLength(3)
    expect(seps[0].text()).toBe('/')
    const custom = mount(OsBreadcrumb, { props: { items, separator: '>' } })
    expect(custom.findAll('span[aria-hidden="true"]')[1].text()).toBe('>')
    // 分隔符不混入条目文本
    expect(custom.findAll('button')[1].text()).toBe('项目资料')
  })

  it('icon 渲染 svg；点击非末项派发 click 并回传该条目；末项不派发', async () => {
    const w = mount(OsBreadcrumb, { props: { items } })
    expect(w.findAll('button')[0].find('svg').exists()).toBe(true)
    await w.findAll('button')[1].trigger('click')
    expect(w.emitted('click')?.[0]).toEqual([items[1]])
    await w.findAll('button')[3].trigger('click')
    expect(w.emitted('click')).toHaveLength(1)
  })

  it('href 条目渲染为链接且保留跳转语义', () => {
    const w = mount(OsBreadcrumb, {
      props: {
        items: [
          { key: 'a', label: 'A', href: '/#/a' },
          { key: 'b', label: 'B' },
        ],
      },
    })
    const link = w.find('a')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('/#/a')
  })
})

describe('OsBreadcrumb 超长路径折叠（省略项经 OsDropdown 承载）', () => {
  const long: BreadcrumbItem[] = [
    { key: 'w', label: 'W' },
    { key: 'p1', label: 'P1' },
    { key: 'p2', label: 'P2' },
    { key: 'p3', label: 'P3' },
    { key: 'p4', label: 'P4' },
    { key: 'f', label: 'F.md' },
  ]

  it('maxVisibleItems=3：首项 + 省略号 + 末项；其余不渲染', () => {
    const w = mount(OsBreadcrumb, { props: { items: long, maxVisibleItems: 3 } })
    const texts = w.findAll('button, a').map((b) => b.text())
    expect(texts).toHaveLength(3)
    expect(texts[0]).toBe('W')
    expect(texts[2]).toBe('F.md')
    const ellipsis = w.find('button[aria-label="展开省略的层级"]')
    expect(ellipsis.exists()).toBe(true)
    expect(ellipsis.text()).toBe('…')
  })

  it('不传 maxVisibleItems 或小于 3 时不折叠', () => {
    const bare = mount(OsBreadcrumb, { props: { items: long } })
    expect(bare.findAll('button')).toHaveLength(6)
    const small = mount(OsBreadcrumb, { props: { items: long, maxVisibleItems: 2 } })
    expect(small.findAll('button')).toHaveLength(6)
  })

  it('点省略号展开下拉，可选中被省略的层级并派发原条目', async () => {
    const w = mount(OsBreadcrumb, { props: { items: long, maxVisibleItems: 3 } })
    expect(w.find('[role="menu"]').exists()).toBe(false)
    await w.find('button[aria-label="展开省略的层级"]').trigger('click')
    const menuItems = w.findAll('[role="menuitem"]')
    expect(menuItems.map((m) => m.text())).toEqual(['P1', 'P2', 'P3', 'P4'])
    await menuItems[2].trigger('click')
    expect(w.emitted('click')?.[0]).toEqual([long[3]])
    expect(w.find('[role="menu"]').exists()).toBe(false)
  })
})
