import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { commandBus } from '@/kernel/bus/commandBus'
import { useNotification } from '@/kernel/stores/notification'

setActivePinia(createPinia())

describe('notification', () => {
  it('push / unread / markAllRead / dismiss / clearAll', () => {
    const notif = useNotification()
    notif.clearAll()
    notif.push('标题一', '内容一')
    notif.push('标题二')
    expect(notif.items).toHaveLength(2)
    expect(notif.unread).toBe(2)
    expect(notif.items[0].title).toBe('标题二')

    notif.markAllRead()
    expect(notif.unread).toBe(0)

    const id = notif.items[0].id
    notif.dismiss(id)
    expect(notif.items).toHaveLength(1)
    notif.clearAll()
    expect(notif.items).toHaveLength(0)
  })

  it('最多保留 50 条', () => {
    const notif = useNotification()
    notif.clearAll()
    for (let i = 0; i < 55; i++) notif.push(`通知 ${i}`)
    expect(notif.items).toHaveLength(50)
    expect(notif.items[0].title).toBe('通知 54')
  })

  it('boot 订阅 vfs:changed：删除与还原产生通知', () => {
    const notif = useNotification()
    notif.clearAll()
    notif.boot()
    commandBus.emit('vfs:changed', { type: 'remove', path: '/我的文件/需求文档.docx' })
    commandBus.emit('vfs:changed', { type: 'restore', path: '/我的文件/需求文档.docx' })
    expect(notif.items.map((n) => n.title)).toEqual(['已还原', '已删除'])
    expect(notif.items[1].body).toBe('需求文档.docx 已移入回收站')
    notif.clearAll()
  })
})
