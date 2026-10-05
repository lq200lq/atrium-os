import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsSelect, type SelectOption, type Size } from '@/ui'
import {
  expectDisabledContract,
  expectSizeContract,
  expectStatusContract,
} from './contract-helpers'

const options: SelectOption[] = [
  { value: 'vue', label: 'Vue' },
  { value: 'react', label: 'React' },
]

describe('OsSelect', () => {
  it('渲染选项并派发所选值', async () => {
    const w = mount(OsSelect, { props: { modelValue: '', options } })
    const select = w.find('select')
    await select.setValue('vue')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['vue'])
  })

  it('placeholder 作为不可选项呈现', () => {
    const w = mount(OsSelect, { props: { modelValue: '', options, placeholder: '请选择框架' } })
    const first = w.findAll('option')[0]
    expect(first.text()).toBe('请选择框架')
    expect(first.attributes('disabled')).toBeDefined()
  })

  it.each(['sm', 'md', 'lg'] as Size[])('%s 档取对应控件高度刻度', (size) => {
    expectSizeContract(mount(OsSelect, { props: { modelValue: '', options, size } }).element, size)
  })

  it('disabled 用 is-disabled 唯一写法并禁用原生控件', () => {
    expectDisabledContract(
      mount(OsSelect, { props: { modelValue: '', options, disabled: true } }).element,
    )
  })

  it('status=error / warning 派生语义描边与状态环', () => {
    expectStatusContract(
      mount(OsSelect, { props: { modelValue: '', options, status: 'error' } }).element,
      'error',
    )
    expectStatusContract(
      mount(OsSelect, { props: { modelValue: '', options, status: 'warning' } }).element,
      'warning',
    )
  })

  it('loading 呈现状态图标', () => {
    const idle = mount(OsSelect, { props: { modelValue: '', options } })
    expect(idle.find('svg').exists()).toBe(false)
    const w = mount(OsSelect, { props: { modelValue: '', options, loading: true } })
    expect(w.find('svg.animate-spin').exists()).toBe(true)
  })
})
