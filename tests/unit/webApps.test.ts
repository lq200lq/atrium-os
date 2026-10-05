import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAppRegistry } from '@/kernel/stores/appRegistry'
import { useWebApps } from '@/kernel/stores/webApps'
import { useWindowManager } from '@/kernel/stores/windowManager'

const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))

vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    // 深拷贝，模拟真实 IDB 的结构化克隆（存的是快照，不是活引用）
    idbStore.set(key, JSON.parse(JSON.stringify(value)))
  }),
}))

const KEY = 'webapps-v1'

/** 等一等 store 里 `void this.persist()` 的异步落库 */
async function flushed() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('webApps 用户网页应用', () => {
  beforeEach(() => {
    idbStore.clear()
    setActivePinia(createPinia())
  })

  it('add 写入 IDB 并立即注册进应用注册表', async () => {
    const webApps = useWebApps()
    const res = webApps.add('示例站', 'example.com')
    await flushed()

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.record).toMatchObject({ id: 'web-example-com', url: 'https://example.com/' })
    expect(useAppRegistry().byId('web-example-com')).toMatchObject({
      name: '示例站',
      icon: 'globe',
      embed: { url: 'https://example.com/' },
      singleton: true,
      permissions: [],
    })
    expect(idbStore.get(KEY)).toEqual([res.record])
  })

  it('地址非法时不落库不注册', async () => {
    const webApps = useWebApps()
    expect(webApps.add('坏站', 'javascript:alert(1)')).toEqual({ ok: false, reason: 'bad-url' })
    expect(webApps.add('', 'https://example.com')).toEqual({ ok: false, reason: 'bad-name' })
    expect(webApps.add('x'.repeat(25), 'https://example.com')).toEqual({
      ok: false,
      reason: 'bad-name',
    })
    await flushed()
    expect(webApps.items).toEqual([])
    expect(idbStore.has(KEY)).toBe(false)
  })

  it('同 host 重复添加换 id，不与内置应用撞 id', () => {
    const registry = useAppRegistry()
    registry.register({
      id: 'web-example-com',
      name: '内置同名',
      icon: 'file',
      entry: () => Promise.resolve({} as never),
      window: { w: 100, h: 100 },
    })
    const webApps = useWebApps()
    const a = webApps.add('一', 'https://example.com')
    const b = webApps.add('二', 'https://example.com/x')
    expect(a.ok && a.record.id).toBe('web-example-com-2')
    expect(b.ok && b.record.id).toBe('web-example-com-3')
    expect(registry.byId('web-example-com')?.name).toBe('内置同名')
  })

  it('update 换地址不换 id，并同步注册表里的 embed', async () => {
    const webApps = useWebApps()
    const res = webApps.add('看板', 'https://example.com/a')
    if (!res.ok) throw new Error('前置失败')
    const upd = webApps.update(res.record.id, '新看板', 'https://other.org/b')
    await flushed()

    expect(upd.ok).toBe(true)
    expect(webApps.items[0]).toMatchObject({
      id: 'web-example-com',
      name: '新看板',
      url: 'https://other.org/b',
    })
    const registered = useAppRegistry().byId('web-example-com')
    expect(registered?.embed?.url).toBe('https://other.org/b')
    expect(useAppRegistry().apps.filter((a) => a.id === 'web-example-com')).toHaveLength(1)
    expect(idbStore.get(KEY)).toEqual([webApps.items[0]])
  })

  it('update 不存在的 id 与非法地址都不改动数据', () => {
    const webApps = useWebApps()
    expect(webApps.update('nope', 'x', 'https://a.com')).toEqual({ ok: false, reason: 'bad-url' })
    const res = webApps.add('ok', 'https://a.com')
    if (!res.ok) throw new Error('前置失败')
    expect(webApps.update(res.record.id, 'n', 'data:text/html,x')).toEqual({
      ok: false,
      reason: 'bad-url',
    })
    expect(webApps.items[0].url).toBe('https://a.com/')
  })

  it('remove 同时关掉活窗口并注销注册表', () => {
    const webApps = useWebApps()
    const res = webApps.add('待删', 'https://example.com')
    if (!res.ok) throw new Error('前置失败')
    const wm = useWindowManager()
    const winId = wm.open(res.record.id)
    expect(winId).not.toBeNull()
    expect(useAppRegistry().byId(res.record.id)).toBeDefined()

    webApps.remove(res.record.id)

    expect(wm.windows).toHaveLength(0)
    expect(useAppRegistry().byId(res.record.id)).toBeUndefined()
    expect(webApps.items).toEqual([])
  })

  it('restore 过 IDB 往返，丢掉手改过的非法记录', async () => {
    const webApps = useWebApps()
    webApps.add('好站', 'https://example.com')
    await flushed()
    // 模拟用户在 DevTools 里把某条地址改成 javascript:
    const saved = JSON.parse(JSON.stringify(idbStore.get(KEY))) as unknown[]
    saved.push({ id: 'web-evil', name: 'evil', url: 'javascript:alert(1)', addedAt: 1 })
    idbStore.set(KEY, saved)

    const next = useWebApps()
    next.items = []
    await next.restore()
    expect(next.items).toHaveLength(1)
    expect(next.items[0]).toMatchObject({ id: 'web-example-com', url: 'https://example.com/' })
  })

  it('restore 对损坏数据（非数组 / 缺字段）保持空表而不抛错', async () => {
    idbStore.set(KEY, { nope: true })
    const a = useWebApps()
    await a.restore()
    expect(a.items).toEqual([])

    idbStore.set(KEY, [null, 1, { id: 'x' }, { id: 'y', name: 'n', url: 'https://y.com' }])
    const b = useWebApps()
    await b.restore()
    expect(b.items).toEqual([{ id: 'y', name: 'n', url: 'https://y.com/', addedAt: 0 }])
  })

  it('isUserApp 只认自己列表里的 id，内置应用恒为 false', () => {
    const registry = useAppRegistry()
    registry.register({
      id: 'files',
      name: '文件',
      icon: 'file',
      entry: () => Promise.resolve({} as never),
      window: { w: 100, h: 100 },
    })
    const webApps = useWebApps()
    webApps.add('站', 'https://example.com')
    expect(webApps.isUserApp('web-example-com')).toBe(true)
    expect(webApps.isUserApp('files')).toBe(false)
  })

  it('toManifest 用 host 作 Spotlight 关键词', () => {
    const webApps = useWebApps()
    const res = webApps.add('站', 'https://docs.example.com/a')
    if (!res.ok) throw new Error('前置失败')
    expect(webApps.toManifest(res.record)).toMatchObject({
      window: { w: 900, h: 620 },
      order: 100,
      keywords: ['docs.example.com'],
    })
  })
})
