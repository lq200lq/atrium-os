import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsTabs, type TabItem } from '@/ui'

const tabs: TabItem[] = [
  { key: 'a', label: 'A' },
  { key: 'b', label: 'B' },
]

describe('OsTabs', () => {
  it('点击页签派发 update:modelValue', async () => {
    const w = mount(OsTabs, {
      props: { tabs, modelValue: 'a' },
      slots: { default: '<p class="pane">面板</p>' },
    })
    expect(w.find('button[aria-selected="true"]').text()).toBe('A')
    await w.findAll('[role="tab"]')[1].trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['b'])
  })

  it('tablist 语义与页签数量一致', () => {
    const w = mount(OsTabs, { props: { tabs, modelValue: 'a' } })
    expect(w.find('[role="tablist"]').exists()).toBe(true)
    expect(w.findAll('[role="tab"]')).toHaveLength(2)
  })

  it('extra 插槽落在页签栏右侧', () => {
    const w = mount(OsTabs, { props: { tabs, modelValue: 'a' }, slots: { extra: '<b>操作</b>' } })
    expect(w.find('.ml-auto b').exists()).toBe(true)
  })
})
