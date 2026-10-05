import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { OsToast } from '@/ui'
import { useNotification } from '@/kernel/stores/notification'

afterEach(() => {
  document.body.innerHTML = ''
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

  it('点击吐司即收起，不打扰通知队列', async () => {
    setActivePinia(createPinia())
    mount(OsToast)
    const notif = useNotification()
    notif.push('仅一次呈现')
    await nextTick()

    const toast = document.body.querySelector('[role="status"]') as HTMLElement
    toast.click()
    await nextTick()
    expect(document.body.querySelector('[role="status"]')).toBeNull()
    expect(notif.items).toHaveLength(1)
  })

  it('无正文时只渲染标题', async () => {
    setActivePinia(createPinia())
    mount(OsToast)
    useNotification().push('只有标题')
    await nextTick()
    expect(document.querySelectorAll('[role="status"] p')).toHaveLength(1)
  })
})
