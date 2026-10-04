import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import { idbGet, idbSet } from '../fs/idb'

const ERRORLOG_KEY = 'errorlog-v1'
/** 环形缓冲上限：只保留最近 N 条，避免无限增长撑爆 IndexedDB */
const MAX_ENTRIES = 50

export type ErrorScope = 'app' | 'window' | 'global' | 'data'

export interface ErrorEntry {
  id: number
  ts: number
  scope: ErrorScope
  /** 关联应用 id（窗口级/应用级错误才有） */
  appId?: string
  message: string
  stack?: string
}

export interface ErrorInput {
  scope: ErrorScope
  appId?: string
  message: string
  stack?: string
}

let seq = 0

/**
 * 全局错误日志：环形缓冲落 IndexedDB，供 settings 应用内回看（失败可查，不只看 console）。
 * 与 data 层 reportError 协同——reportError 负责通知中心即时提示，此处负责可追溯留痕。
 */
export const useErrorLog = defineStore('errorLog', {
  state: () => ({
    entries: [] as ErrorEntry[],
  }),
  getters: {
    count: (state) => state.entries.length,
  },
  actions: {
    capture(input: ErrorInput): ErrorEntry {
      const entry: ErrorEntry = { id: ++seq, ts: Date.now(), ...input }
      this.entries.unshift(entry)
      if (this.entries.length > MAX_ENTRIES) this.entries.length = MAX_ENTRIES
      void this.persist()
      return entry
    },

    /** 从 unknown 异常归一化出 message/stack */
    captureError(scope: ErrorScope, e: unknown, appId?: string): ErrorEntry {
      const err = e instanceof Error ? e : new Error(String(e))
      return this.capture({ scope, appId, message: err.message, stack: err.stack })
    },

    clear() {
      this.entries = []
      void this.persist()
    },

    async persist() {
      try {
        await idbSet(
          ERRORLOG_KEY,
          toRaw(this.entries).map((e) => ({ ...e })),
        )
      } catch (err) {
        console.warn('[errorLog] 持久化失败', err)
      }
    },

    async restore() {
      try {
        const saved = await idbGet<ErrorEntry[]>(ERRORLOG_KEY)
        if (Array.isArray(saved)) {
          this.entries = saved.slice(0, MAX_ENTRIES)
          seq = this.entries.reduce((m, e) => Math.max(m, e.id), 0)
        }
      } catch (err) {
        console.warn('[errorLog] 恢复失败', err)
      }
    },
  },
})
