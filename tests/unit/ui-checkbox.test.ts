import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsCheckbox } from '@/ui'

describe('OsCheckbox', () => {
  it('change 派发布尔值', async () => {
    const w = mount(OsCheckbox, { props: { modelValue: false, label: '同意' } })
    expect(w.text()).toContain('同意')
    await w.find('input[type="checkbox"]').setValue(true)
    expect(w.emitted('update:modelValue')?.[0]).toEqual([true])
  })

  it('label 是可选文案，缺省不渲染节点', () => {
    expect(mount(OsCheckbox, { props: { modelValue: true } }).text()).toBe('')
    expect(mount(OsCheckbox, { props: { modelValue: true, label: '条款' } }).text()).toBe('条款')
  })
})
