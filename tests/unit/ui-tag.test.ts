import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsTag, type BadgeStatus } from '@/ui'

const TINTS: Record<BadgeStatus, string> = {
  default: 'bg-fill-quaternary',
  error: 'bg-danger-bg',
  warning: 'bg-warning-bg',
  success: 'bg-success-bg',
  info: 'bg-info-bg',
}

describe('OsTag', () => {
  it.each(Object.keys(TINTS) as BadgeStatus[])('status=%s 取对应浅底染色档', (status) => {
    expect(mount(OsTag, { props: { status } }).classes()).toContain(TINTS[status])
  })

  it('内容走默认插槽，chip 圆角 + micro 字号', () => {
    const w = mount(OsTag, { slots: { default: '功能' } })
    expect(w.text()).toBe('功能')
    expect(w.classes()).toEqual(expect.arrayContaining(['rounded-chip', 'text-micro']))
  })

  it('bordered=false 用透明边框占位，高度不跳动', () => {
    const w = mount(OsTag, { props: { bordered: false } })
    expect(w.classes()).toEqual(expect.arrayContaining(['border', 'border-transparent']))
  })

  it('closable 渲染关闭按钮并派发 close', async () => {
    const w = mount(OsTag)
    expect(w.find('button').exists()).toBe(false)
    const c = mount(OsTag, { props: { closable: true }, slots: { default: 'x' } })
    await c.find('button').trigger('click')
    expect(c.emitted('close')).toHaveLength(1)
  })

  it('icon 走白名单图标', () => {
    expect(
      mount(OsTag, { props: { icon: 'settings' } })
        .find('svg')
        .exists(),
    ).toBe(true)
  })
})
