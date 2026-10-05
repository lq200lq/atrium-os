import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
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

  it('name 可显式分组，缺省按实例生成唯一组名', () => {
    const w = mount(OsRadio, { props: { modelValue: 'a', options, name: 'lang' } })
    for (const i of w.findAll('input[type="radio"]')) {
      expect(i.attributes('name')).toBe('lang')
    }
  })

  it('同页两组不传 name 也各自独立（原生 radio 靠 name 互斥）', () => {
    const TwoGroups = defineComponent({
      setup: () => () =>
        h('div', [
          h(OsRadio, { modelValue: 'a', options }),
          h(OsRadio, { modelValue: 'a', options }),
        ]),
    })
    const names = mount(TwoGroups)
      .findAll('input[type="radio"]')
      .map((i) => i.attributes('name')!)
    expect(names[0]).toMatch(/^os-radio-/)
    expect(names[0]).toBe(names[1])
    expect(names[2]).toBe(names[3])
    expect(names[0]).not.toBe(names[2])
  })
})
