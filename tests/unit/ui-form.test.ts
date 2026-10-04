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
})
