import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsInputNumber, type Size } from '@/ui'
import {
  expectDisabledContract,
  expectSizeContract,
  expectStatusContract,
} from './contract-helpers'

describe('OsInputNumber', () => {
  it('显示并回写数值，失焦按 min/max 钳制', async () => {
    const w = mount(OsInputNumber, { props: { modelValue: 10, min: 0, max: 20 } })
    const input = w.find('input')
    expect(input.element.value).toBe('10')
    await input.setValue('25')
    await input.trigger('blur')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([20])
  })

  it('非法文本失焦回退为当前值', async () => {
    const w = mount(OsInputNumber, { props: { modelValue: 7 } })
    const input = w.find('input')
    await input.setValue('abc')
    await input.trigger('blur')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(input.element.value).toBe('7')
  })

  it('清空失焦派发 undefined', async () => {
    const w = mount(OsInputNumber, { props: { modelValue: 3 } })
    const input = w.find('input')
    await input.setValue('')
    await input.trigger('blur')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([undefined])
  })

  it('步进钮与方向键按 step 增减，precision 固定小数位', async () => {
    const w = mount(OsInputNumber, { props: { modelValue: 0.1, step: 0.2, precision: 2 } })
    const buttons = () => w.findAll('button')
    await buttons()[0].trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([0.3])
    await w.setProps({ modelValue: 0.3 })
    await buttons()[1].trigger('click')
    expect(w.emitted('update:modelValue')?.[1]).toEqual([0.1])
    await w.setProps({ modelValue: 0.1 })
    await w.find('input').trigger('keydown.up')
    expect(w.emitted('update:modelValue')?.[2]).toEqual([0.3])
    await w.setProps({ modelValue: 0.3 })
    expect(w.find('input').element.value).toBe('0.30')
  })

  it('达到上下界时对应步进钮禁用', () => {
    const w = mount(OsInputNumber, { props: { modelValue: 20, min: 0, max: 20 } })
    const [up, down] = w.findAll('button')
    expect(up.attributes('disabled')).toBeDefined()
    expect(down.attributes('disabled')).toBeUndefined()
  })

  it('disabled 时步进钮整体禁用且输入框真禁用', () => {
    const w = mount(OsInputNumber, { props: { modelValue: 1, disabled: true } })
    expect(w.find('input').attributes('disabled')).toBeDefined()
  })

  it.each(['sm', 'md', 'lg'] as Size[])('%s 档取对应控件高度刻度', (size) => {
    expectSizeContract(mount(OsInputNumber, { props: { modelValue: 1, size } }).element, size)
  })

  it('disabled 用 is-disabled 唯一写法并禁用原生控件', () => {
    expectDisabledContract(
      mount(OsInputNumber, { props: { modelValue: 1, disabled: true } }).element,
    )
  })

  it('status=error / warning 派生语义描边与状态环', () => {
    expectStatusContract(
      mount(OsInputNumber, { props: { modelValue: 1, status: 'error' } }).element,
      'error',
    )
    expectStatusContract(
      mount(OsInputNumber, { props: { modelValue: 1, status: 'warning' } }).element,
      'warning',
    )
  })
})
