import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsSpin } from '@/ui'
import { classTokens } from './contract-helpers'

describe('OsSpin 内联型', () => {
  it('无插槽即指示器：role=status + aria-busy，缺省 loading 挂载即转', () => {
    const w = mount(OsSpin)
    const status = w.find('[role="status"]')
    expect(status.exists()).toBe(true)
    expect(status.attributes('aria-busy')).toBe('true')
    expect(status.attributes('aria-live')).toBe('polite')
  })

  it.each([
    ['sm', 'h-control-sm'],
    ['md', 'h-control'],
    ['lg', 'h-control-lg'],
  ] as const)('size=%s 直径走控件高刻度 %s', (size, cls) => {
    const w = mount(OsSpin, { props: { size } })
    expect(classTokens(w.element)).toContain(cls)
  })

  it('tip 文案渲染', () => {
    const w = mount(OsSpin, { props: { tip: '加载中…' } })
    expect(w.text()).toContain('加载中…')
  })

  it('loading=false 时内联型不渲染', () => {
    const w = mount(OsSpin, { props: { loading: false } })
    expect(w.find('[role="status"]').exists()).toBe(false)
  })
})

describe('OsSpin 容器遮罩型', () => {
  it('loading 时包内容盖遮罩 + 居中指示器，根节点 aria-busy', () => {
    const w = mount(OsSpin, {
      props: { loading: true, tip: '同步中' },
      slots: { default: '<p>被包住的内容</p>' },
    })
    expect(w.text()).toContain('被包住的内容')
    expect(w.attributes('aria-busy')).toBe('true')
    const overlay = w.find('[role="status"]')
    const cls = overlay.classes()
    expect(cls).toContain('absolute')
    expect(cls).toContain('inset-0')
    expect(overlay.text()).toContain('同步中')
  })

  it('loading=false 只渲染内容，不出现遮罩与 aria-busy', () => {
    const w = mount(OsSpin, {
      props: { loading: false },
      slots: { default: '<p>正常内容</p>' },
    })
    expect(w.text()).toContain('正常内容')
    expect(w.attributes('aria-busy')).toBeUndefined()
    expect(w.find('[role="status"]').exists()).toBe(false)
  })
})
