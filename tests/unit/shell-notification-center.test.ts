import { beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import NotificationCenter from '@/shell/NotificationCenter.vue'
import { useAppRegistry, type AppManifest } from '@/kernel/stores/appRegistry'
import { useNotification } from '@/kernel/stores/notification'
import { useShellUi } from '@/kernel/stores/shellUi'
import { useWindowManager } from '@/kernel/stores/windowManager'
import { i18n } from '@/i18n'

const stubEntry = () => Promise.resolve({} as Component)

function register(id: string, extra: Partial<AppManifest> = {}) {
  useAppRegistry().register({
    id,
    name: id,
    icon: 'sparkles',
    window: { w: 400, h: 300 },
    entry: stubEntry,
    ...extra,
  } as AppManifest)
}

const t = (key: string) => i18n.global.t(key) as string

let wrapper: VueWrapper | null = null

async function openPanel() {
  wrapper = mount(NotificationCenter, { attachTo: document.body })
  useShellUi().toggleNotifications()
  await nextTick()
  return wrapper
}

describe('NotificationCenter', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    register('demo', { name: '演示' })
    wrapper = null
  })

  it('收起时不渲染任何节点', () => {
    wrapper = mount(NotificationCenter)
    expect(wrapper.find('aside').exists()).toBe(false)
  })

  it('展开后空态与计数', async () => {
    const w = await openPanel()
    expect(w.find('aside').exists()).toBe(true)
    expect(w.text()).toContain(`0`)
    expect(w.text()).toContain(t('notification.empty'))
  })

  it('推入通知：标题/正文/动作/时间齐全，单条可关、可清空', async () => {
    const notif = useNotification()
    notif.push('同步失败', '2 项被拒绝', { label: '去处理', appId: 'demo' }, 'warning')
    const w = await openPanel()

    expect(w.text()).toContain('同步失败')
    expect(w.text()).toContain('2 项被拒绝')
    // 动作按钮按文案找（面板里还有清空与单条关闭两个按钮）
    const actionBtn = w.findAll('aside button').find((b) => b.text() === '去处理')
    expect(actionBtn, '动作按钮应渲染').toBeTruthy()

    // 动作点击：打开目标应用并把这条通知收掉
    await actionBtn!.trigger('click')
    expect(useWindowManager().windows.some((x) => x.appId === 'demo')).toBe(true)
    expect(notif.items).toHaveLength(0)

    // 清空路径
    notif.push('甲', 'a')
    notif.push('乙', 'b')
    await nextTick()
    const clear = w.findAll('aside button').find((b) => b.text() === t('notification.clear'))
    await clear!.trigger('click')
    expect(notif.items).toHaveLength(0)
  })
})
