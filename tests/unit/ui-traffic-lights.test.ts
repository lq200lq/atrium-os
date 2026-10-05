import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsTrafficLights } from '@/ui'

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
