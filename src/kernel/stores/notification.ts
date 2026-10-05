import { defineStore } from 'pinia'
import { commandBus } from '../bus/commandBus'
import { baseName, type VfsChangeEvent } from '../fs/types'

export interface NoticeAction {
  label: string
  appId: string
}

/** 通知分级：与 OsAlert/OsToast 的语义档位同名，缺省 info（旧调用方不传即保持现行为） */
export type NoticeLevel = 'success' | 'error' | 'warning' | 'info'

export interface Notice {
  id: number
  title: string
  body?: string
  time: number
  read: boolean
  action?: NoticeAction
  level?: NoticeLevel
}

let seq = 0
let booted = false

export const useNotification = defineStore('notification', {
  state: () => ({
    items: [] as Notice[],
  }),
  getters: {
    unread: (state) => state.items.filter((n) => !n.read).length,
  },
  actions: {
    boot() {
      if (booted) return
      booted = true
      commandBus.on('vfs:changed', (payload) => {
        const e = payload as VfsChangeEvent
        if (e.type === 'remove')
          this.push('已删除', `${baseName(e.path)} 已移入回收站`, undefined, 'info')
        if (e.type === 'restore') this.push('已还原', baseName(e.path), undefined, 'success')
      })
    },

    push(title: string, body?: string, action?: NoticeAction, level?: NoticeLevel): number {
      seq += 1
      this.items.unshift({ id: seq, title, body, time: Date.now(), read: false, action, level })
      if (this.items.length > 50) this.items.pop()
      return seq
    },

    dismiss(id: number) {
      const idx = this.items.findIndex((n) => n.id === id)
      if (idx !== -1) this.items.splice(idx, 1)
    },

    clearAll() {
      this.items = []
    },

    markAllRead() {
      this.items.forEach((n) => (n.read = true))
    },
  },
})
