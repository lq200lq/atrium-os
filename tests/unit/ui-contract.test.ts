import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsButton, OsCheckbox, OsForm, OsInput, OsRadio, OsSelect, OsSwitch, type Size } from '@/ui'
import {
  CONTROL_HEIGHT,
  classTokens,
  expectDisabledContract,
  expectSizeContract,
  expectStatusContract,
} from './contract-helpers'

type Case = [name: string, render: () => Element]

const options = [{ value: 'a', label: 'A' }]
const nameField = [{ key: 'name', label: '名称', type: 'input' as const, required: true }]

const sizedControls: { name: string; render: (size: Size) => Element }[] = [
  { name: 'OsButton', render: (size) => mount(OsButton, { props: { size } }).element },
  {
    name: 'OsInput',
    render: (size) => mount(OsInput, { props: { modelValue: '', size } }).element,
  },
  {
    name: 'OsSelect',
    render: (size) => mount(OsSelect, { props: { modelValue: '', options, size } }).element,
  },
]

const disabledCases: Case[] = [
  ['OsInput', () => mount(OsInput, { props: { modelValue: '', disabled: true } }).element],
  [
    'OsSelect',
    () => mount(OsSelect, { props: { modelValue: '', options, disabled: true } }).element,
  ],
  ['OsCheckbox', () => mount(OsCheckbox, { props: { modelValue: false, disabled: true } }).element],
  [
    'OsRadio',
    () => mount(OsRadio, { props: { modelValue: 'a', options, disabled: true } }).element,
  ],
  ['OsSwitch', () => mount(OsSwitch, { props: { modelValue: false, disabled: true } }).element],
  [
    'OsForm',
    () =>
      mount(OsForm, { props: { modelValue: { name: '' }, fields: nameField, disabled: true } })
        .element,
  ],
]

describe('size 契约：三档高度取自 --control-height-* 刻度', () => {
  for (const { name, render } of sizedControls) {
    for (const size of ['sm', 'md', 'lg'] as const) {
      it(`${name} 的 ${size} 档渲染 ${CONTROL_HEIGHT[size]}`, () => {
        expectSizeContract(render(size), size)
      })
    }
  }

  it('档位只映射刻度类名，像素一致性交由 E2E 实测', () => {
    // happy-dom 不加载 Tailwind 产物，实测 getComputedStyle(el).height 与
    // var(--control-height-*) 都是空串，像素断言在 tests/e2e/control-height.spec.ts 完成。
    const host = document.createElement('div')
    document.body.appendChild(host)
    const w = mount(OsButton, { props: { size: 'lg' }, attachTo: host })
    const el = w.element as HTMLElement
    expect(classTokens(el)).toContain('h-control-lg')
    expect(window.getComputedStyle(el).height).toBe('')
    w.unmount()
    host.remove()
  })
})

describe('disabled 契约：同一套断言跑遍 Input/Select/Checkbox/Radio/Switch/Form', () => {
  it.each(disabledCases)('%s disabled 用 is-disabled 唯一写法并禁用原生控件', (_name, render) => {
    expectDisabledContract(render())
  })
})

describe('status 契约：非 default 态在各控件派生同一组语义刻度类', () => {
  const casesOf = (status: 'error' | 'warning'): Case[] => [
    ['OsInput', () => mount(OsInput, { props: { modelValue: '', status } }).element],
    ['OsSelect', () => mount(OsSelect, { props: { modelValue: '', options, status } }).element],
    ['OsCheckbox', () => mount(OsCheckbox, { props: { modelValue: false, status } }).element],
    ['OsRadio', () => mount(OsRadio, { props: { modelValue: 'a', options, status } }).element],
    ['OsSwitch', () => mount(OsSwitch, { props: { modelValue: false, status } }).element],
  ]

  for (const status of ['error', 'warning'] as const) {
    it.each(casesOf(status))(`%s status=${status}`, (_name, render) => {
      expectStatusContract(render(), status)
    })
  }

  it('OsForm 校验失败后把 error 态下传给字段控件', async () => {
    const w = mount(OsForm, { props: { modelValue: { name: '' }, fields: nameField } })
    await w.find('form').trigger('submit')
    expectStatusContract(w.element, 'error')
    expect(w.text()).toContain('名称不能为空')
  })
})
