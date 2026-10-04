import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useErrorLog } from '@/kernel/observability/errorLog'

const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))

vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value)
  }),
}))

describe('errorLog 环形缓冲', () => {
  beforeEach(() => {
    idbStore.clear()
    setActivePinia(createPinia())
  })

  it('capture 落条目、最新在前', () => {
    const log = useErrorLog()
    log.capture({ scope: 'global', message: 'first' })
    log.capture({ scope: 'window', message: 'second', appId: 'gallery' })
    expect(log.entries[0].message).toBe('second')
    expect(log.entries[0].appId).toBe('gallery')
    expect(log.entries[1].message).toBe('first')
    expect(log.count).toBe(2)
  })

  it('超过 50 条时截断为最近 50 条', () => {
    const log = useErrorLog()
    for (let i = 0; i < 60; i++) log.capture({ scope: 'global', message: `e${i}` })
    expect(log.entries).toHaveLength(50)
    expect(log.entries[0].message).toBe('e59')
    expect(log.entries[49].message).toBe('e10')
  })

  it('captureError 从 Error 归一化 message/stack', () => {
    const log = useErrorLog()
    const err = new Error('boom')
    log.captureError('app', err, 'data-board')
    expect(log.entries[0].message).toBe('boom')
    expect(log.entries[0].scope).toBe('app')
    expect(log.entries[0].appId).toBe('data-board')
    expect(log.entries[0].stack).toContain('Error: boom')
  })

  it('clear 清空', () => {
    const log = useErrorLog()
    log.capture({ scope: 'global', message: 'x' })
    log.clear()
    expect(log.count).toBe(0)
  })

  it('persist + restore 往返还原', async () => {
    const log = useErrorLog()
    log.capture({ scope: 'data', message: 'query failed' })
    await log.persist()
    setActivePinia(createPinia())
    const fresh = useErrorLog()
    await fresh.restore()
    expect(fresh.entries).toHaveLength(1)
    expect(fresh.entries[0].message).toBe('query failed')
    expect(fresh.entries[0].scope).toBe('data')
  })
})
