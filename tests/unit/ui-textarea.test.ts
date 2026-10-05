import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsTextarea, type Size } from '@/ui'
import { classTokens, expectDisabledContract, expectStatusContract } from './contract-helpers'

// 多行控件的高度属于 rows/autosize 语义，size 档驱动 control.ts 的内边距刻度
const PADDING: Record<Size, string> = { sm: 'px-xs', md: 'px-sm', lg: 'px-md' }

describe('OsTextarea', () => {
  it('v-model 回写与 placeholder 透传', async () => {
    const w = mount(OsTextarea, { props: { modelValue: '', placeholder: '请输入' } })
    const ta = w.find('textarea')
    expect(ta.attributes('placeholder')).toBe('请输入')
    await ta.setValue('备注')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['备注'])
  })

  it.each(['sm', 'md', 'lg'] as Size[])('%s 档取内边距刻度', (size) => {
    expect(classTokens(mount(OsTextarea, { props: { modelValue: '', size } }).element)).toContain(
      PADDING[size],
    )
  })

  it('autosize 按 minRows/maxRows 钳制行数', async () => {
    const w = mount(OsTextarea, {
      props: { modelValue: '', autosize: { minRows: 2, maxRows: 4 } },
    })
    expect(w.find('textarea').attributes('rows')).toBe('2')
    await w.setProps({ modelValue: 'a\nb\nc\nd\ne' })
    expect(w.find('textarea').attributes('rows')).toBe('4')
  })

  it('非 autosize 模式 rows 固定', () => {
    const w = mount(OsTextarea, { props: { modelValue: '', rows: 5 } })
    expect(w.find('textarea').attributes('rows')).toBe('5')
  })

  it('showCount 与 maxLength：原生限长并实时计数', async () => {
    const w = mount(OsTextarea, { props: { modelValue: 'abc', showCount: true, maxLength: 5 } })
    expect(w.find('textarea').attributes('maxlength')).toBe('5')
    await w.setProps({ modelValue: 'abcd' })
    expect(w.text()).toContain('4 / 5')
  })

  it('disabled 用 is-disabled 唯一写法并禁用原生控件', () => {
    expectDisabledContract(mount(OsTextarea, { props: { modelValue: '', disabled: true } }).element)
  })

  it('status=error / warning 派生语义描边与状态环', () => {
    expectStatusContract(
      mount(OsTextarea, { props: { modelValue: '', status: 'error' } }).element,
      'error',
    )
    expectStatusContract(
      mount(OsTextarea, { props: { modelValue: '', status: 'warning' } }).element,
      'warning',
    )
  })
})
