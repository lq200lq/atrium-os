import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsAlert } from '@/ui'
import { classTokens } from './contract-helpers'

describe('OsAlert', () => {
  it('非 banner 为 role=status，banner 为 role=alert', () => {
    const w = mount(OsAlert, { props: { message: '提示' } })
    expect(w.find('[role="status"]').exists()).toBe(true)
    expect(w.find('[role="alert"]').exists()).toBe(false)
    const banner = mount(OsAlert, { props: { message: '警示', banner: true } })
    expect(banner.find('[role="alert"]').exists()).toBe(true)
  })

  it.each([
    ['info', ['bg-info-bg', 'text-info-text', 'border-info-border']],
    ['success', ['bg-success-bg', 'text-success-text', 'border-success-border']],
    ['warning', ['bg-warning-bg', 'text-warning-text', 'border-warning-border']],
    ['error', ['bg-danger-bg', 'text-danger-text', 'border-danger-border']],
  ] as const)('%s 浅底/文字/描边全部派生自语义刻度', (type, tokens) => {
    const w = mount(OsAlert, { props: { type, message: 'm' } })
    const cls = classTokens(w.element)
    for (const token of tokens) expect(cls, `type=${type}`).toContain(token)
  })

  it('message / description props 与 default 插槽（描述逃生口）', () => {
    const w = mount(OsAlert, { props: { message: '标题', description: '描述文本' } })
    expect(w.text()).toContain('标题')
    expect(w.text()).toContain('描述文本')
    const s = mount(OsAlert, { props: { message: '标题' }, slots: { default: '插槽描述' } })
    expect(s.text()).toContain('插槽描述')
  })

  it('action 插槽渲染操作区', () => {
    const w = mount(OsAlert, { props: { message: 'm' }, slots: { action: '<b>操作</b>' } })
    expect(w.text()).toContain('操作')
  })

  it('closable 显示带 aria-label 的关闭钮，点击派发 close', async () => {
    const w = mount(OsAlert, { props: { message: 'm', closable: true } })
    const btn = w.find('button[aria-label="关闭"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(w.emitted('close')).toBeTruthy()
  })

  it('showIcon 缺省渲染语义图标，关闭后不渲染', () => {
    const w = mount(OsAlert, { props: { type: 'warning', message: 'm' } })
    expect(w.find('svg').exists()).toBe(true)
    const bare = mount(OsAlert, { props: { type: 'warning', message: 'm', showIcon: false } })
    expect(bare.find('svg').exists()).toBe(false)
  })
})
