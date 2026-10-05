import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsRadio, type RadioOption } from '@/ui'

const options: RadioOption[] = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
]

describe('OsRadio', () => {
  it('选中项派发对应 value', async () => {
    const w = mount(OsRadio, { props: { modelValue: 'a', options } })
    const inputs = w.findAll('input[type="radio"]')
    expect(inputs).toHaveLength(2)
    await inputs[1].trigger('change')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['b'])
  })

  it('渲染 radiogroup 语义与选中态', () => {
    const w = mount(OsRadio, { props: { modelValue: 'b', options } })
    expect(w.attributes('role')).toBe('radiogroup')
    const checked = w
      .findAll('input[type="radio"]')
      .map((i) => (i.element as HTMLInputElement).checked)
    expect(checked).toEqual([false, true])
  })

  it('name 可分组，缺省同名互斥', () => {
    const w = mount(OsRadio, { props: { modelValue: 'a', options, name: 'lang' } })
    for (const i of w.findAll('input[type="radio"]')) {
      expect(i.attributes('name')).toBe('lang')
    }
  })
})
