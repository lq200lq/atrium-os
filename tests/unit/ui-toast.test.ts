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

  it('分级：缺省 info 走被动 status，error/warning 走 alert 抢播报', async () => {
    setActivePinia(createPinia())
    const notif = useNotification()
    mount(OsToast)
    notif.push('已同步', undefined, undefined, 'success')
    await nextTick()
    expect(document.body.querySelector('[role="status"]')).not.toBeNull()

    document.body.innerHTML = ''
    mount(OsToast)
    notif.clearAll()
    notif.push('同步失败', undefined, undefined, 'error')
    await nextTick()
    expect(document.body.querySelector('[role="alert"]')).not.toBeNull()
  })

  it('等级只取 internal/level 的语义刻度，不出现裸色值', async () => {
    setActivePinia(createPinia())
    const notif = useNotification()
    mount(OsToast)
    notif.push('空间不足', undefined, undefined, 'warning')
    await nextTick()
    const icon = document.body.querySelector('[role="alert"] svg') as SVGSVGElement
    expect(icon.classList.contains('text-warning-text')).toBe(true)
  })
})
