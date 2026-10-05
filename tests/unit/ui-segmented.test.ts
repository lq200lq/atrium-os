import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsSegmented, type SegmentedOption, type Size } from '@/ui'
import { expectDisabledContract, expectSizeContract } from './contract-helpers'

const options: SegmentedOption[] = [
  { value: 'a', label: '甲' },
  { value: 'b', label: '乙' },
  { value: 'c', label: '丙' },
]

const radios = (w: ReturnType<typeof mount>) => w.findAll('[role="radio"]')

describe('OsSegmented', () => {
  it('radiogroup 语义，选中项 aria-checked', () => {
    const w = mount(OsSegmented, { props: { options, modelValue: 'b', label: '视图' } })
    expect(w.attributes('role')).toBe('radiogroup')
    expect(w.attributes('aria-label')).toBe('视图')
    expect(radios(w).map((r) => r.attributes('aria-checked'))).toEqual(['false', 'true', 'false'])
  })

  it('点击未选中项派发 update:modelValue', async () => {
    const w = mount(OsSegmented, { props: { options, modelValue: 'a' } })
    await radios(w)[2].trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['c'])
  })

  it('方向键循环移动选中项并同步派发', async () => {
    const w = mount(OsSegmented, { props: { options, modelValue: 'a' } })
    await radios(w)[0].trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['b'])
    await radios(w)[0].trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['c'])
    // 末位再向右回绕到首位
    await radios(w)[0].trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['a'])
    await radios(w)[0].trigger('keydown', { key: 'ArrowLeft' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['c'])
  })

  it('Home / End 直达首尾', async () => {
    const w = mount(OsSegmented, { props: { options, modelValue: 'b' } })
    await radios(w)[1].trigger('keydown', { key: 'End' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['c'])
    await radios(w)[1].trigger('keydown', { key: 'Home' })
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['a'])
  })

  it('roving tabindex：仅选中项可聚焦（tabindex 0）', () => {
    const w = mount(OsSegmented, { props: { options, modelValue: 'b' } })
    expect(radios(w).map((r) => r.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
  })

  it.each(['sm', 'md', 'lg'] as Size[])('size=%s 走控件高度刻度', (size) => {
    expectSizeContract(
      mount(OsSegmented, { props: { options, modelValue: 'a', size } }).element,
      size,
    )
  })

  it('disabled 契约：is-disabled + 原生 disabled，且按键不改变值', async () => {
    const w = mount(OsSegmented, { props: { options, modelValue: 'a', disabled: true } })
    expectDisabledContract(w.element)
    await radios(w)[0].trigger('click')
    await radios(w)[0].trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('block 时铺满容器', () => {
    expect(
      mount(OsSegmented, { props: { options, modelValue: 'a', block: true } }).classes(),
    ).toContain('w-full')
  })
})
