import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import { desktopBounds } from '@/kernel/layout'
import { useAppRegistry } from '@/kernel/stores/appRegistry'
import { useWindowManager } from '@/kernel/stores/windowManager'

const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))

vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value)
  }),
}))

const stubEntry = () => Promise.resolve({} as Component)

function registerTestApps() {
  const registry = useAppRegistry()
  registry.register({
    id: 'demo',
    name: '演示应用',
    icon: 'file',
    entry: stubEntry,
    window: { w: 800, h: 600, minW: 400, minH: 300 },
  })
  registry.register({
    id: 'solo',
    name: '单例应用',
    icon: 'file',
    entry: stubEntry,
    window: { w: 400, h: 300 },
    singleton: true,
  })
}

describe('windowManager', () => {
  beforeEach(() => {
    idbStore.clear()
    setActivePinia(createPinia())
    registerTestApps()
  })

  it('open 新建窗口并聚焦', () => {
    const wm = useWindowManager()
    const id = wm.open('demo')
    expect(id).toBeTruthy()
    const win = wm.byId(id!)
    expect(win?.title).toBe('演示应用')
    expect(win?.status).toBe('normal')
    expect(wm.activeId).toBe(id)
    expect(win?.z).toBe(wm.topZ)
  })

  it('未知应用返回 null', () => {
    expect(useWindowManager().open('nope')).toBeNull()
  })

  it('多实例按 payload.key 去重复用', () => {
    const wm = useWindowManager()
    const a1 = wm.open('demo', { key: 'doc-1' })
    const a2 = wm.open('demo', { key: 'doc-1' })
    const b = wm.open('demo', { key: 'doc-2' })
    expect(a2).toBe(a1)
    expect(b).not.toBe(a1)
  })

  it('singleton 重复打开复用窗口', () => {
    const wm = useWindowManager()
    expect(wm.open('solo')).toBe(wm.open('solo'))
    expect(wm.windows).toHaveLength(1)
  })

  it('focus 单调抬升 z', () => {
    const wm = useWindowManager()
    const a = wm.open('demo')!
    const b = wm.open('demo')!
    wm.focus(a)
    expect(wm.byId(a)!.z).toBeGreaterThan(wm.byId(b)!.z)
    expect(wm.activeId).toBe(a)
  })

  it('最小化后活动窗口回落到最上层', () => {
    const wm = useWindowManager()
    const a = wm.open('demo')!
    const b = wm.open('demo')!
    wm.minimize(b)
    expect(wm.activeId).toBe(a)
    wm.restore(b)
    expect(wm.activeId).toBe(b)
    expect(wm.byId(b)!.status).toBe('normal')
  })

  it('toggleMax 保存与还原 prevRect', () => {
    const wm = useWindowManager()
    const id = wm.open('demo')!
    const before = { x: wm.byId(id)!.x, y: wm.byId(id)!.y, w: wm.byId(id)!.w, h: wm.byId(id)!.h }
    wm.toggleMax(id)
    const bounds = desktopBounds()
    const max = wm.byId(id)!
    expect(max.status).toBe('maximized')
    expect(max.x).toBe(bounds.x)
    expect(max.w).toBe(bounds.w)
    wm.toggleMax(id)
    const restored = wm.byId(id)!
    expect(restored.status).toBe('normal')
    expect(restored.prevRect).toBeUndefined()
    expect(restored.x).toBe(before.x)
    expect(restored.w).toBe(before.w)
  })

  it('close 后活动窗口转移', () => {
    const wm = useWindowManager()
    const a = wm.open('demo')!
    const b = wm.open('demo')!
    wm.close(b)
    expect(wm.activeId).toBe(a)
    expect(wm.windows).toHaveLength(1)
  })

  it('cascadeAll 层叠排布', () => {
    const wm = useWindowManager()
    const ids = [wm.open('demo')!, wm.open('demo')!]
    for (const id of ids) wm.resize(id, { x: 100, y: 100, w: 400, h: 300 })
    wm.cascadeAll()
    const [w1, w2] = ids.map((id) => wm.byId(id)!)
    expect(w2.x - w1.x).toBe(28)
    expect(w2.y - w1.y).toBe(28)
  })

  it('persistLayout 落快照', async () => {
    const wm = useWindowManager()
    wm.open('solo')
    await wm.persistLayout()
    const saved = idbStore.get('layout-v1') as { appId: string; status: string }[]
    expect(saved).toHaveLength(1)
    expect(saved[0].appId).toBe('solo')
    expect(saved[0].status).toBe('normal')
  })

  it('schedulePersist 防抖后落库', () => {
    vi.useFakeTimers()
    const wm = useWindowManager()
    wm.open('solo')
    wm.schedulePersist()
    wm.schedulePersist()
    expect(idbStore.has('layout-v1')).toBe(false)
    vi.advanceTimersByTime(400)
    vi.useRealTimers()
    return vi.waitFor(() => expect(idbStore.has('layout-v1')).toBe(true))
  })

  it('restoreLayout 还原布局并跳过未知应用', async () => {
    idbStore.set('layout-v1', [
      { appId: 'demo', title: '演示应用', x: 10, y: 50, w: 800, h: 600, z: 14, status: 'normal' },
      { appId: 'ghost', title: '幽灵', x: 1, y: 1, w: 100, h: 100, z: 15, status: 'minimized' },
      {
        appId: 'solo',
        title: '单例应用',
        x: 20,
        y: 60,
        w: 400,
        h: 300,
        z: 12,
        status: 'minimized',
      },
    ])
    const wm = useWindowManager()
    await wm.restoreLayout()
    expect(wm.windows).toHaveLength(2)
    expect(wm.windows.map((w) => w.appId)).toEqual(['demo', 'solo'])
    expect(wm.windows[0].z).toBe(14)
    expect(wm.windows[1].status).toBe('minimized')
    expect(wm.topZ).toBe(15)
    expect(wm.activeId).toBe(wm.windows[0].id)
  })
})
