import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OsForm, { type FormField } from '@/ui/OsForm.vue'

const fields: FormField[] = [
  { key: 'name', label: '名称', type: 'input', required: true, min: 2 },
  { key: 'framework', label: '框架', type: 'select', options: [{ value: 'vue', label: 'Vue' }] },
]

describe('OsForm', () => {
  it('必填空值时拦截提交并显示错误', async () => {
    const w = mount(OsForm, { props: { fields, modelValue: { name: '' } } })
    await w.find('form').trigger('submit')
    expect(w.emitted('submit')).toBeUndefined()
    expect(w.text()).toContain('名称不能为空')
  })

  it('长度不足触发 min 校验', async () => {
    const w = mount(OsForm, { props: { fields, modelValue: { name: 'a' } } })
    await w.find('form').trigger('submit')
    expect(w.emitted('submit')).toBeUndefined()
    expect(w.text()).toContain('至少 2 个字符')
  })

  it('校验通过后派发 submit 与当前值', async () => {
    const w = mount(OsForm, { props: { fields, modelValue: { name: '张三', framework: 'vue' } } })
    await w.find('form').trigger('submit')
    expect(w.emitted('submit')?.[0]?.[0]).toEqual({ name: '张三', framework: 'vue' })
  })

  it('编辑控件回写 modelValue', async () => {
    const w = mount(OsForm, { props: { fields, modelValue: { name: '' } } })
    await w.find('input').setValue('李四')
    expect(w.emitted('update:modelValue')?.[0]?.[0]).toMatchObject({ name: '李四' })
  })

  it('textarea 字段收口为 OsTextarea（控件全部出自 src/ui）并回写', async () => {
    const taFields: FormField[] = [{ key: 'note', label: '备注', type: 'textarea' }]
    const w = mount(OsForm, { props: { fields: taFields, modelValue: { note: '' } } })
    const ta = w.find('textarea')
    expect(ta.exists()).toBe(true)
    expect(ta.attributes('rows')).toBe('3')
    await ta.setValue('多行说明')
    expect(w.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({ note: '多行说明' })
  })
})
