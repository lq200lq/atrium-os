import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsResult } from '@/ui'
import { classTokens } from './contract-helpers'

describe('OsResult', () => {
  it('role=status；缺省标题/副标题走 i18n', () => {
    const w = mount(OsResult)
    expect(w.find('[role="status"]').exists()).toBe(true)
    expect(w.text()).toContain('操作成功')
    expect(w.text()).toContain('更改已保存并生效')
  })

  it('title / subtitle props 覆盖缺省文案', () => {
    const w = mount(OsResult, { props: { title: '自定义标题', subtitle: '自定义副标题' } })
    expect(w.text()).toContain('自定义标题')
    expect(w.text()).toContain('自定义副标题')
    expect(w.text()).not.toContain('操作成功')
  })

  it.each([
    ['error', '操作失败', ['bg-danger-bg', 'text-danger-text']],
    ['403', '无访问权限', ['bg-warning-bg', 'text-warning-text']],
    ['warning', '未知异常', ['bg-warning-bg', 'text-warning-text']],
  ] as const)('%s 型呈现缺省标题与语义浅底图标', (status, title, tokens) => {
    const w = mount(OsResult, { props: { status } })
    expect(w.text()).toContain(title)
    const cls = classTokens(w.element)
    for (const token of tokens) expect(cls, `status=${status}`).toContain(token)
  })

  it('403 承接鉴权语义：shield 图标渲染', () => {
    const w = mount(OsResult, { props: { status: '403' } })
    expect(w.find('svg').exists()).toBe(true)
  })

  it('default 插槽放补充内容、extra 插槽放操作出口', () => {
    const w = mount(OsResult, {
      props: { status: 'error' },
      slots: { default: '<p>失败项两条</p>', extra: '<button>重试</button>' },
    })
    expect(w.text()).toContain('失败项两条')
    expect(w.find('button').exists()).toBe(true)
  })

  it('icon 插槽可替换缺省状态图标', () => {
    const w = mount(OsResult, { slots: { icon: '<i>custom</i>' } })
    expect(w.text()).toContain('custom')
  })
})
