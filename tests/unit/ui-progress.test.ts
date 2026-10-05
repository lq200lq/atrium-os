import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsProgress } from '@/ui'
import { classTokens } from './contract-helpers'

describe('OsProgress 条形', () => {
  it('role=progressbar 带 aria-valuenow/min/max', () => {
    const w = mount(OsProgress, { props: { percent: 42 } })
    const bar = w.find('[role="progressbar"]')
    expect(bar.attributes('aria-valuenow')).toBe('42')
    expect(bar.attributes('aria-valuemin')).toBe('0')
    expect(bar.attributes('aria-valuemax')).toBe('100')
  })

  it('percent 钳制到 0..100', () => {
    const over = mount(OsProgress, { props: { percent: 150 } })
    expect(over.find('[role="progressbar"]').attributes('aria-valuenow')).toBe('100')
    expect(over.text()).toContain('100%')
    const under = mount(OsProgress, { props: { percent: -20 } })
    expect(under.find('[role="progressbar"]').attributes('aria-valuenow')).toBe('0')
  })

  it('normal 用强调色档', () => {
    const w = mount(OsProgress, { props: { percent: 30 } })
    expect(classTokens(w.element)).toContain('bg-accent')
  })

  it('满格自动推导 success，不必显式传 status', () => {
    const w = mount(OsProgress, { props: { percent: 100 } })
    expect(classTokens(w.element)).toContain('bg-success')
  })

  it('exception 需显式传入并派生 danger 档', () => {
    const w = mount(OsProgress, { props: { percent: 60, status: 'exception' } })
    expect(classTokens(w.element)).toContain('bg-danger')
    const notAuto = mount(OsProgress, { props: { percent: 100, status: 'exception' } })
    expect(classTokens(notAuto.element)).toContain('bg-danger')
  })

  it('showInfo=false 隐藏百分比文本', () => {
    const w = mount(OsProgress, { props: { percent: 42, showInfo: false } })
    expect(w.text()).not.toContain('42%')
  })
})

describe('OsProgress 环形', () => {
  it('SVG 描边消费 currentColor，色类走语义档', () => {
    const w = mount(OsProgress, { props: { percent: 25, type: 'circle' } })
    const circles = w.findAll('circle')
    expect(circles).toHaveLength(2)
    for (const c of circles) expect(c.attributes('stroke')).toBe('currentColor')
    expect(classTokens(w.element)).toContain('text-accent')
  })

  it('success / exception 换色', () => {
    const ok = mount(OsProgress, { props: { percent: 100, type: 'circle' } })
    expect(classTokens(ok.element)).toContain('text-success')
    const bad = mount(OsProgress, { props: { percent: 40, type: 'circle', status: 'exception' } })
    expect(classTokens(bad.element)).toContain('text-danger')
  })

  it('直径走间距刻度 2xl，环内显示百分比，满格换 check 图标', () => {
    const w = mount(OsProgress, { props: { percent: 50, type: 'circle' } })
    expect(w.find('[role="progressbar"]').classes()).toContain('h-2xl')
    expect(w.text()).toContain('50%')
    const done = mount(OsProgress, { props: { percent: 100, type: 'circle' } })
    expect(done.text()).not.toContain('100%')
    // 环 SVG + success 态内嵌 check 图标 SVG
    expect(done.findAll('svg')).toHaveLength(2)
    expect(w.findAll('svg')).toHaveLength(1)
  })
})
