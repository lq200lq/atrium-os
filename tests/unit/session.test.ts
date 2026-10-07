import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import { useAppRegistry } from '@/kernel/stores/appRegistry'
import { useNotification } from '@/kernel/stores/notification'
import { useSession } from '@/kernel/stores/session'
import { useSettings } from '@/kernel/stores/settings'
import { useWindowManager } from '@/kernel/stores/windowManager'

const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))

vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value)
  }),
}))

const stubEntry = () => Promise.resolve({} as Component)

function seedApps() {
  const registry = useAppRegistry()
  registry.register({
    id: 'public-app',
    name: '公开应用',
    icon: 'puzzle',
    entry: stubEntry,
    window: { w: 400, h: 300 },
    order: 1,
  })
  registry.register({
    id: 'editor-app',
    name: '编辑应用',
    icon: 'file',
    entry: stubEntry,
    window: { w: 400, h: 300 },
    order: 2,
    permissions: ['app:file-manager'],
  })
}

describe('session 权限模型', () => {
  beforeEach(() => {
    idbStore.clear()
    setActivePinia(createPinia())
    useSettings()
    seedApps()
  })

  it('默认管理员拥有通配权限，可访问全部应用', () => {
    const session = useSession()
    expect(session.currentUser.id).toBe('admin')
    expect(session.has('app:editor')).toBe(true)
    expect(useAppRegistry().accessibleApps.map((a) => a.id)).toEqual(['public-app', 'editor-app'])
  })

  it('访客仅可访问公开应用', () => {
    const session = useSession()
    session.setUser('guest')
    expect(session.has('app:editor')).toBe(false)
    expect(useAppRegistry().accessibleApps.map((a) => a.id)).toEqual(['public-app'])
  })

  it('编辑者命中权限点后可编辑应用', () => {
    const session = useSession()
    session.setUser('editor')
    expect(session.canAccess(useAppRegistry().byId('editor-app'))).toBe(true)
    expect(useAppRegistry().accessibleApps).toHaveLength(2)
  })

  it('无权限应用不出现在任何派生入口', () => {
    const session = useSession()
    session.setUser('guest')
    const registry = useAppRegistry()
    expect(registry.accessibleApps.some((a) => a.id === 'editor-app')).toBe(false)
    expect(registry.dockApps.some((a) => a.id === 'editor-app')).toBe(false)
  })

  it('wm.open 未授权返回 null 并在通知中心留痕', () => {
    useSession().setUser('guest')
    const wm = useWindowManager()
    const notif = useNotification()
    expect(wm.open('editor-app')).toBeNull()
    expect(notif.items[0]?.title).toBe('无权访问')
    expect(notif.items[0]?.action?.appId).toBe('settings')
  })

  it('wm.open 已授权正常开窗', () => {
    useSession().setUser('admin')
    const wm = useWindowManager()
    expect(wm.open('editor-app')).not.toBeNull()
    expect(wm.windows).toHaveLength(1)
  })

  it('角色切换后持久化，restore 还原', async () => {
    const session = useSession()
    session.setUser('editor')
    await session.persist()
    const fresh = createPinia()
    setActivePinia(fresh)
    const restored = useSession()
    await restored.restore()
    expect(restored.currentUserId).toBe('editor')
  })
})
