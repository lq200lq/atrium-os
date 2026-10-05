import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsDialog } from '@/ui'

interface DialogProps {
  title?: string
  confirmText?: string
  cancelText?: string
  loading?: boolean
  maskClosable?: boolean
}

const mountDialog = (props: DialogProps = {}) =>
  mount(OsDialog, {
    props: { title: '重命名', ...props },
    slots: { default: '<input class="stub" />' },
  })

describe('OsDialog', () => {
  it('确认/取消/点击遮罩', async () => {
    const wrapper = mountDialog()
    expect(wrapper.find('input.stub').exists()).toBe(true)

    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click')
    await buttons[1].trigger('click')
    await wrapper.find('.bg-scrim').trigger('pointerdown.self')
    expect(wrapper.emitted('cancel')).toHaveLength(2)
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('缺省文案来自 i18n，可被 props 覆盖', () => {
    expect(mountDialog().findAll('button')[1].text()).toBe('确定')
    expect(mountDialog({ confirmText: '保存', cancelText: '放弃' }).text()).toContain('放弃')
  })

  it('确认按钮 loading：禁用 + 状态图标，取消仍可点', async () => {
    const w = mountDialog({ loading: true })
    const confirm = w.findAll('button')[1]
    expect(confirm.attributes('disabled')).toBeDefined()
    expect(confirm.find('svg.animate-spin').exists()).toBe(true)
    await w.findAll('button')[0].trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })

  it('maskClosable=false 时点遮罩不关闭', async () => {
    const w = mountDialog({ maskClosable: false })
    await w.find('.bg-scrim').trigger('pointerdown.self')
    expect(w.emitted('cancel')).toBeUndefined()
  })

  it('maskClosable 缺省为 true（保持既有行为）', async () => {
    const w = mountDialog()
    await w.find('.bg-scrim').trigger('pointerdown.self')
    expect(w.emitted('cancel')).toHaveLength(1)
  })
})
