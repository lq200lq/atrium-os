import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import OsDrawer from '@/ui/OsDrawer.vue'
import OsEmpty from '@/ui/OsEmpty.vue'
import OsSkeleton from '@/ui/OsSkeleton.vue'
import OsTabs from '@/ui/OsTabs.vue'
import OsToast from '@/ui/OsToast.vue'
import OsTooltip from '@/ui/OsTooltip.vue'
import { useNotification } from '@/kernel/stores/notification'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('OsEmpty', () => {
  it('渲染描述与操作插槽', () => {
    const w = mount(OsEmpty, {
      props: { description: '没有记录' },
      slots: { action: '<button class="act">新建</button>' },
    })
    expect(w.text()).toContain('没有记录')
    expect(w.find('button.act').exists()).toBe(true)
  })
})

describe('OsSkeleton', () => {
  it('text 变体按 rows 渲染占位条', () => {
    const w = mount(OsSkeleton, { props: { variant: 'text', rows: 4 } })
    expect(w.find('[aria-busy="true"]').exists()).toBe(true)
    expect(w.findAll('.animate-pulse > div')).toHaveLength(4)
  })
})

describe('OsTooltip', () => {
  it('悬停显示提示文本', async () => {
    const w = mount(OsTooltip, {
      props: { text: '提示语' },
      slots: { default: '<button>触发</button>' },
    })
    expect(w.text()).not.toContain('提示语')
    await w.find('span').trigger('mouseenter')
    expect(w.find('[role="tooltip"]').text()).toBe('提示语')
  })
})

describe('OsTabs', () => {
  it('点击页签派发 update:modelValue', async () => {
    const w = mount(OsTabs, {
      props: {
        tabs: [
          { key: 'a', label: 'A' },
          { key: 'b', label: 'B' },
        ],
        modelValue: 'a',
      },
      slots: { default: '<p class="pane">面板</p>' },
    })
    expect(w.find('button[aria-selected="true"]').text()).toBe('A')
    await w.findAll('[role="tab"]')[1].trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['b'])
  })
})

describe('OsDrawer', () => {
  it('打开渲染内容，关闭按钮派发 update:modelValue 与 close', async () => {
    const w = mount(OsDrawer, {
      props: { modelValue: true, title: '抽屉标题' },
      slots: { default: '<p>抽屉内容X</p>' },
    })
    await nextTick()
    expect(document.body.textContent).toContain('抽屉内容X')
    const closeBtn = document.body.querySelector('button[title="关闭"]') as HTMLButtonElement
    closeBtn.click()
    await nextTick()
    expect(w.emitted('update:modelValue')?.[0]).toEqual([false])
    expect(w.emitted('close')).toBeTruthy()
  })
})

describe('OsToast', () => {
  it('消费 notification store：新通知以瞬态吐司呈现', async () => {
    setActivePinia(createPinia())
    mount(OsToast)
    useNotification().push('吐司标题T', '吐司正文T')
    await nextTick()
    expect(document.body.textContent).toContain('吐司标题T')
    expect(document.body.textContent).toContain('吐司正文T')
  })
})
