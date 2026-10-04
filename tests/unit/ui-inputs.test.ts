import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OsCheckbox from '@/ui/OsCheckbox.vue'
import OsRadio from '@/ui/OsRadio.vue'
import OsSelect from '@/ui/OsSelect.vue'
import OsSwitch from '@/ui/OsSwitch.vue'

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
})

describe('OsCheckbox', () => {
  it('change 派发布尔值', async () => {
    const w = mount(OsCheckbox, { props: { modelValue: false, label: '同意' } })
    await w.find('input[type="checkbox"]').setValue(true)
    expect(w.emitted('update:modelValue')?.[0]).toEqual([true])
  })
})

describe('OsRadio', () => {
  it('选中项派发对应 value', async () => {
    const w = mount(OsRadio, {
      props: {
        modelValue: 'a',
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      },
    })
    const inputs = w.findAll('input[type="radio"]')
    expect(inputs).toHaveLength(2)
    await inputs[1].trigger('change')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['b'])
  })
})

describe('OsSelect', () => {
  it('渲染选项并派发所选值', async () => {
    const w = mount(OsSelect, {
      props: { modelValue: '', options: [{ value: 'vue', label: 'Vue' }] },
    })
    const select = w.find('select')
    await select.setValue('vue')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['vue'])
  })
})
