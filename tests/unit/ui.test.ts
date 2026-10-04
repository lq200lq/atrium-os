import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OsBadge from '@/ui/OsBadge.vue'
import OsButton from '@/ui/OsButton.vue'
import OsDialog from '@/ui/OsDialog.vue'
import OsInput from '@/ui/OsInput.vue'
import OsTrafficLights from '@/ui/OsTrafficLights.vue'

describe('OsButton', () => {
  it('渲染插槽与 disabled', () => {
    const wrapper = mount(OsButton, { slots: { default: '按钮' }, props: { disabled: true } })
    expect(wrapper.text()).toBe('按钮')
    expect(wrapper.attributes('disabled')).toBeDefined()
  })

  it('variant 决定样式', () => {
    const primary = mount(OsButton, { props: { variant: 'primary' } })
    const danger = mount(OsButton, { props: { variant: 'danger' } })
    expect(primary.classes()).toContain('bg-accent')
    expect(danger.classes()).toContain('text-danger')
  })
})

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
})

describe('OsDialog', () => {
  it('确认/取消/点击遮罩', async () => {
    const wrapper = mount(OsDialog, {
      props: { title: '重命名' },
      slots: { default: '<input class="stub" />' },
    })
    expect(wrapper.find('input.stub').exists()).toBe(true)

    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click')
    await buttons[1].trigger('click')
    await wrapper.find('.bg-slate-900\\/25').trigger('pointerdown.self')
    expect(wrapper.emitted('cancel')).toHaveLength(2)
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })
})

describe('OsTrafficLights', () => {
  it('三钮映射三个动作', async () => {
    const wrapper = mount(OsTrafficLights)
    const buttons = wrapper.findAll('button')
    expect(buttons.map((b) => b.attributes('title'))).toEqual(['关闭', '最小化', '最大化 / 还原'])
    await buttons[0].trigger('click')
    await buttons[1].trigger('click')
    await buttons[2].trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('minimize')).toHaveLength(1)
    expect(wrapper.emitted('maximize')).toHaveLength(1)
  })
})

describe('OsBadge', () => {
  it('数量阈值显示', () => {
    expect(
      mount(OsBadge, { props: { count: 0 } })
        .find('span')
        .exists(),
    ).toBe(false)
    expect(mount(OsBadge, { props: { count: 5 } }).text()).toBe('5')
    expect(mount(OsBadge, { props: { count: 12 } }).text()).toBe('9+')
  })
})
