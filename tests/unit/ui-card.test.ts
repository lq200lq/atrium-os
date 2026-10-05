import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsCard } from '@/ui'

describe('OsCard', () => {
  it('默认描边 + 内边距的表面层', () => {
    const w = mount(OsCard, { slots: { default: '<p class="body">内容</p>' } })
    expect(w.classes()).toEqual(
      expect.arrayContaining([
        'rounded-surface',
        'bg-surface',
        'shadow-raise',
        'border',
        'border-line',
      ]),
    )
    expect(w.find('.p-md').text()).toBe('内容')
  })

  it('bordered=false 去掉边框（无内边距内容铺满场景）', () => {
    const w = mount(OsCard, { props: { bordered: false, padded: false } })
    expect(w.classes()).not.toContain('border-line')
    expect(w.find('.p-md').exists()).toBe(false)
  })

  it('title prop 与 title 插槽渲染标题行', () => {
    expect(mount(OsCard, { props: { title: '标题' } }).text()).toBe('标题')
    const w = mount(OsCard, { slots: { title: '<b class="tt">插槽标题</b>' } })
    expect(w.find('.tt').exists()).toBe(true)
  })

  it('无标题与 extra 时不渲染 header', () => {
    expect(mount(OsCard).find('header').exists()).toBe(false)
  })

  it('extra 插槽在标题行右侧，footer 插槽独立成区', () => {
    const w = mount(OsCard, {
      props: { title: 'T' },
      slots: { extra: '<button class="ex">操作</button>', footer: '<span class="ft">页脚</span>' },
    })
    expect(w.find('header .ex').exists()).toBe(true)
    expect(w.find('footer .ft').exists()).toBe(true)
  })
})
