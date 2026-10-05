import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsSwitch } from '@/ui'

describe('OsSwitch', () => {
  it('点击切换并派发 update:modelValue', async () => {
    const w = mount(OsSwitch, { props: { modelValue: false, label: '开关' } })
    expect(w.text()).toContain('开关')
    await w.find('button[role="switch"]').trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([true])
  })

  it('disabled 时不响应点击', async () => {
    const w = mount(OsSwitch, { props: { modelValue: false, disabled: true } })
    await w.find('button[role="switch"]').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('aria-checked 反映当前值', () => {
    const on = mount(OsSwitch, { props: { modelValue: true } })
    expect(on.find('button[role="switch"]').attributes('aria-checked')).toBe('true')
    const off = mount(OsSwitch, { props: { modelValue: false } })
    expect(off.find('button[role="switch"]').attributes('aria-checked')).toBe('false')
  })
})
