import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { mountFeedbackHost, mountOrphanConsumer } from './feedback-helpers'
import { useNotification } from '@/kernel/stores/notification'
import type { FeedbackApi } from '@/ui/feedback'

describe('FeedbackHost 命令式反馈', () => {
  let api: FeedbackApi
  let notif: ReturnType<typeof useNotification>

  beforeEach(() => {
    setActivePinia(createPinia())
    notif = useNotification()
    notif.clearAll()
  })

  it('四个等级入口写进同一份通知队列并带 level', () => {
    const w = mountFeedbackHost((a) => (api = a))
    api.success('已保存')
    api.error('同步失败', '网络不可用')
    api.warning('空间不足')
    api.info('有新版本')
    expect(notif.items.map((n) => n.level)).toEqual(['info', 'warning', 'error', 'success'])
    expect(notif.items[2].body).toBe('网络不可用')
    w.unmount()
  })

  it('notify 走通用入口，缺省等级为 info', () => {
    const w = mountFeedbackHost((a) => (api = a))
    const id = api.notify({ title: '已删除', body: 'a.docx' })
    expect(notif.items[0].id).toBe(id)
    expect(notif.items[0].level).toBe('info')
    w.unmount()
  })

  it('confirm 确认返回 true，取消返回 false，并收起对话框', async () => {
    const w = mountFeedbackHost((a) => (api = a))
    const done = api.confirm({ title: '删除文件', content: '确定要删除吗？' })
    await nextTick()
    expect(w.text()).toContain('确定要删除吗？')
    const buttons = w.findAll('button')
    await buttons[buttons.length - 1].trigger('click') // OsDialog：取消在前、确认在后
    expect(await done).toBe(true)
    await nextTick()
    expect(w.text()).not.toContain('确定要删除吗？')

    const cancelled = api.confirm({ title: '再次确认' })
    await nextTick()
    await w.findAll('button')[0].trigger('click')
    expect(await cancelled).toBe(false)
    w.unmount()
  })

  it('confirm 文案可覆盖，未给时回退 i18n 通用文案', async () => {
    const w = mountFeedbackHost((a) => (api = a))
    const custom = api.confirm({ title: '移入回收站', okText: '删除', cancelText: '留下' })
    await nextTick()
    expect(w.findAll('button').map((b) => b.text())).toEqual(['留下', '删除'])
    await w.findAll('button')[1].trigger('click')
    await expect(custom).resolves.toBe(true)

    const fallback = api.confirm({ title: '默认文案' })
    await nextTick()
    expect(w.findAll('button').map((b) => b.text())).toEqual(['取消', '确定'])
    await w.findAll('button')[0].trigger('click')
    await expect(fallback).resolves.toBe(false)
    w.unmount()
  })

  it('后发起的确认覆盖前一个，前者判为取消而不悬挂', async () => {
    const w = mountFeedbackHost((a) => (api = a))
    const first = api.confirm({ title: '第一个' })
    await nextTick()
    const second = api.confirm({ title: '第二个' })
    await nextTick()
    await expect(first).resolves.toBe(false)
    expect(w.text()).toContain('第二个')
    await w.findAll('button')[1].trigger('click')
    await expect(second).resolves.toBe(true)
    w.unmount()
  })
})

describe('useFeedback 上下文约束', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('未挂载宿主时直接报错，不静默退化成全局单例', () => {
    expect(() => mountOrphanConsumer()).toThrow(/FeedbackHost/)
  })

  it('每个宿主各一套 API，不共享全局单例', () => {
    const seen: FeedbackApi[] = []
    const a = mountFeedbackHost((api) => seen.push(api))
    const b = mountFeedbackHost((api) => seen.push(api))
    expect(seen[0]).not.toBe(seen[1])
    a.unmount()
    b.unmount()
  })
})
