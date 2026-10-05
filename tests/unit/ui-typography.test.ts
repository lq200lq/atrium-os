import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsTypography } from '@/ui'

describe('OsTypography', () => {
  it('默认 text 型取正文档', () => {
    const w = mount(OsTypography, { slots: { default: '正文' } })
    expect(w.find('p').classes()).toEqual(
      expect.arrayContaining(['text-ui', 'leading-body', 'text-ink']),
    )
  })

  it('title 型用 heading-3 档位', () => {
    expect(
      mount(OsTypography, { props: { type: 'title' } })
        .find('p')
        .classes(),
    ).toEqual(expect.arrayContaining(['text-heading-3', 'font-strong']))
  })

  it('link + href 渲染 a 元素', () => {
    const w = mount(OsTypography, { props: { type: 'link', href: 'https://vuejs.org' } })
    expect(w.find('a').attributes('href')).toBe('https://vuejs.org')
    expect(w.find('a').classes()).toContain('text-accent-text')
  })

  it('strong / disabled / status 映射到刻度类', () => {
    const strong = mount(OsTypography, { props: { strong: true } }).find('p')
    expect(strong.classes()).toContain('font-strong')
    expect(
      mount(OsTypography, { props: { disabled: true } })
        .find('p')
        .classes(),
    ).toContain('is-disabled')
    expect(
      mount(OsTypography, { props: { status: 'error' } })
        .find('p')
        .classes(),
    ).toContain('text-danger-text')
    expect(
      mount(OsTypography, { props: { status: 'warning' } })
        .find('p')
        .classes(),
    ).toContain('text-warning-text')
  })

  it('ellipsis 按 rows 施加 line-clamp 档', () => {
    const w = mount(OsTypography, { props: { ellipsis: true, rows: 2 } })
    expect(w.find('p').classes()).toContain('line-clamp-2')
  })

  it('expandable：省略 + 展开切换，收起后 clamp 消失', async () => {
    const w = mount(OsTypography, { props: { ellipsis: true, rows: 1, expandable: true } })
    const toggle = w.findAll('button')[0]
    expect(w.find('p').classes()).toContain('line-clamp-1')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(w.find('p').classes()).not.toContain('line-clamp-1')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(toggle.text()).toBe('收起')
  })

  it('无 ellipsis 时不渲染切换按钮', () => {
    expect(
      mount(OsTypography, { props: { expandable: true } })
        .find('button')
        .exists(),
    ).toBe(false)
  })
})
