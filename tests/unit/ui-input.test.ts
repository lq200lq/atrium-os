import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsInput, type Size } from '@/ui'
import {
  expectDisabledContract,
  expectSizeContract,
  expectStatusContract,
} from './contract-helpers'

describe('OsInput', () => {
  it('v-model 与 enter/esc 事件', async () => {
    const wrapper = mount(OsInput, { props: { modelValue: '' } })
    const input = wrapper.find('input')
    await input.setValue('需求')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['需求'])
    await input.trigger('keydown.enter')
    await input.trigger('keydown.esc')
    expect(wrapper.emitted('enter')).toHaveLength(1)
    expect(wrapper.emitted('esc')).toHaveLength(1)
  })

  it('placeholder 透传到原生 input', () => {
    const w = mount(OsInput, { props: { modelValue: '', placeholder: '搜索…' } })
    expect(w.find('input').attributes('placeholder')).toBe('搜索…')
  })

  it.each(['sm', 'md', 'lg'] as Size[])('%s 档取对应控件高度刻度', (size) => {
    expectSizeContract(mount(OsInput, { props: { modelValue: '', size } }).element, size)
  })

  it('disabled 用 is-disabled 唯一写法并禁用原生控件', () => {
    expectDisabledContract(mount(OsInput, { props: { modelValue: '', disabled: true } }).element)
  })

  it('status=error / warning 派生语义描边与状态环', () => {
    const error = mount(OsInput, { props: { modelValue: '', status: 'error' } }).element
    expectStatusContract(error, 'error')
    const warning = mount(OsInput, { props: { modelValue: '', status: 'warning' } }).element
    expectStatusContract(warning, 'warning')
  })

  it('默认状态是中性描边，不带状态环', () => {
    const tokens = mount(OsInput, { props: { modelValue: '' } }).classes()
    expect(tokens).toContain('border-line')
    expect(tokens.some((t) => t.startsWith('ring-'))).toBe(false)
  })

  it('clearable 仅在非空时显示清除钮', () => {
    expect(
      mount(OsInput, { props: { modelValue: '', clearable: true } })
        .find('button')
        .exists(),
    ).toBe(false)
    const w = mount(OsInput, { props: { modelValue: '需求', clearable: true } })
    expect(w.find('button').exists()).toBe(true)
  })

  it('点击清除钮派发空值与 clear 事件', async () => {
    const w = mount(OsInput, { props: { modelValue: '需求', clearable: true } })
    await w.find('button').trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([''])
    expect(w.emitted('clear')).toHaveLength(1)
  })

  it('prefix / suffix 插槽渲染在输入两侧', () => {
    const w = mount(OsInput, {
      props: { modelValue: '' },
      slots: { prefix: '<i class="pre">前</i>', suffix: '<i class="suf">后</i>' },
    })
    expect(w.find('.pre').exists()).toBe(true)
    expect(w.find('.suf').exists()).toBe(true)
    const tags = w.findAll('i, input').map((n) => n.element.tagName)
    expect(tags).toEqual(['I', 'INPUT', 'I'])
  })
})
