import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import { useSession } from '@/kernel/stores/session'
import { useWidgetRegistry, type WidgetManifest } from '@/kernel/stores/widgetRegistry'
import { useWidgets, type WidgetConfigValues } from '@/kernel/stores/widgets'
import { useWindowManager } from '@/kernel/stores/windowManager'

const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))

vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    // 真 IDB 走结构化克隆：代理与函数都克隆不了。这里照抄这一条（不是 JSON 往返），
    // 才能像真库一样把「响应式代理混进落库数据」暴露成 DataCloneError。
    idbStore.set(key, structuredClone(value))
  }),
}))

const KEY = 'widgets-v1'
const KINDS_KEY = 'widget-kinds-v1'
const stubEntry = () => Promise.resolve({} as Component)

/** 等一等 store 里 `void this.persist()` 的异步落库 */
async function flushed() {
  await Promise.resolve()
  await Promise.resolve()
}

function kind(id: string, extra: Partial<WidgetManifest> = {}): WidgetManifest {
  return {
    id,
    name: id,
    icon: 'sparkles',
    entry: stubEntry,
    widget: { sizes: ['sm', 'md'] },
    ...extra,
  }
}

function seedKinds() {
  const registry = useWidgetRegistry()
  registry.register(
    kind('clock', { order: 10, widget: { sizes: ['sm', 'md'], defaultSize: 'md' } }),
  )
  registry.register(kind('todos', { order: 30, widget: { sizes: ['md'] } }))
  registry.register(kind('default-on', { order: 40, seed: true }))
  registry.register(kind('gated', { order: 50, permissions: ['widget:secret'] }))
  registry.register(
    kind('city', {
      order: 20,
      widget: { sizes: ['sm', 'md'] },
      config: [
        { key: 'city', type: 'text', default: '上海' },
        { key: 'format', type: 'select', options: ['12h', '24h'], default: '24h' },
      ],
    }),
  )
}

describe('widgets 实例与摆放', () => {
  beforeEach(() => {
    idbStore.clear()
    setActivePinia(createPinia())
    seedKinds()
  })

  it('add 推入实例并落库，不触碰应用注册表', async () => {
    const widgets = useWidgets()
    const res = widgets.add('clock')
    await flushed()

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.reused).toBe(false)
    expect(res.instance).toMatchObject({
      id: 'wgt-clock',
      kindId: 'clock',
      size: 'md',
      pos: null,
    })
    expect(idbStore.get(KEY)).toEqual([res.instance])
  })

  it('缺省尺寸取 manifest.defaultSize（无则取 sizes[0]），显式尺寸越界则拒绝且不落库', async () => {
    const widgets = useWidgets()
    const clock = widgets.add('clock')
    expect(clock.ok && clock.instance.size).toBe('md') // defaultSize 优先于 sizes[0]

    const todos = widgets.add('todos')
    expect(todos.ok && todos.instance.size).toBe('md') // 未声明 defaultSize，取 sizes[0]

    expect(widgets.add('clock', 'lg')).toEqual({ ok: false, reason: 'bad-size' })
    expect(widgets.add('nope')).toEqual({ ok: false, reason: 'unknown-kind' })
    await flushed()
    expect(widgets.items).toHaveLength(2)
  })

  it('singleton 第二次添加复用既有实例，不新增记录', () => {
    useWidgetRegistry().register(kind('weather', { singleton: true }))
    const widgets = useWidgets()
    const first = widgets.add('weather')
    const second = widgets.add('weather')
    expect(first.ok && second.ok && second.reused).toBe(true)
    expect(widgets.items).toHaveLength(1)
    expect(second.ok && first.ok && second.instance.id).toBe(first.ok ? first.instance.id : '')
  })

  it('多实例 kind 每次添加各得一个实例 id', () => {
    const widgets = useWidgets()
    widgets.add('clock')
    widgets.add('clock')
    expect(widgets.items.map((i) => i.id)).toEqual(['wgt-clock', 'wgt-clock-2'])
  })

  it('config 按 schema 收敛：缺省填 default，未声明的键被丢弃', () => {
    const widgets = useWidgets()
    const res = widgets.add('city', 'sm', { city: '东京', evil: 'x' } as never)
    expect(res.ok && res.instance.config).toEqual({ city: '东京', format: '24h' })

    const bare = widgets.add('city')
    expect(bare.ok && bare.instance.config).toEqual({ city: '上海', format: '24h' })
  })

  it('setSize 受 manifest.widget.sizes 约束', () => {
    const widgets = useWidgets()
    const res = widgets.add('clock')
    if (!res.ok) throw new Error('前置失败')
    widgets.setSize(res.instance.id, 'sm')
    expect(widgets.items[0].size).toBe('sm')
    widgets.setSize(res.instance.id, 'lg')
    expect(widgets.items[0].size).toBe('sm')
  })

  it('updateConfig 收敛后立即改内存、经 300ms 防抖才落库', async () => {
    vi.useFakeTimers()
    try {
      const widgets = useWidgets()
      const res = widgets.add('city')
      if (!res.ok) throw new Error('前置失败')
      await flushed()

      widgets.updateConfig(res.instance.id, { format: '12h' })
      expect(widgets.items[0].config).toEqual({ city: '上海', format: '12h' })

      // 防抖窗口（CONFIG_PERSIST_DEBOUNCE=300）之内不许写库——E6「每个击键一次 IDB 写」的解法
      expect((idbStore.get(KEY) as { config: WidgetConfigValues }[])[0].config).toEqual({
        city: '上海',
        format: '24h',
      })
      await vi.advanceTimersByTimeAsync(300)
      await flushed()
      expect(idbStore.get(KEY)).toEqual([widgets.items[0]])
    } finally {
      vi.useRealTimers()
    }
  })

  it('remove 只摘记录：无窗口可关，窗口管理器不受影响', () => {
    const widgets = useWidgets()
    const res = widgets.add('clock')
    if (!res.ok) throw new Error('前置失败')
    const wm = useWindowManager()

    widgets.remove(res.instance.id)

    expect(widgets.items).toEqual([])
    expect(wm.windows).toEqual([])
    widgets.remove('nope') // 幂等
  })

  it('renderable 不给出 kind 已卸载的实例', () => {
    const widgets = useWidgets()
    widgets.add('clock')
    widgets.add('ghost')
    expect(widgets.renderable.map((i) => i.kindId)).toEqual(['clock'])

    useWidgetRegistry().unregister('clock')
    expect(widgets.renderable).toEqual([])
    // 记录仍在 IDB 里，只是无从渲染（kind 回来后即可见面）
    expect(widgets.items).toHaveLength(1)
  })

  it('renderable 过滤当前会话无权限的 kind', () => {
    const widgets = useWidgets()
    widgets.add('clock')
    widgets.add('gated')
    expect(widgets.renderable.map((i) => i.kindId)).toEqual(['clock', 'gated'])

    useSession().setUser('guest')
    expect(widgets.renderable.map((i) => i.kindId)).toEqual(['clock'])
    // 记录仍在：换回有权限的角色即可重新见面
    expect(widgets.items).toHaveLength(2)
  })

  it('restore 保留落库的数组顺序：顺序权威是下标，addedAt 只做元数据（§4.7 第 1 步）', async () => {
    idbStore.set(KEY, [
      { id: 'b', kindId: 'clock', size: 'md', pos: null, addedAt: 2 },
      { id: 'a', kindId: 'clock', size: 'md', pos: null, addedAt: 1 },
    ])
    const widgets = useWidgets()
    await widgets.restore()
    // 旧口径「按 addedAt 升序、同刻用 id 兜底」已废：restore 不再排序，落库什么样进来就什么样
    expect(widgets.renderable.map((i) => i.id)).toEqual(['b', 'a'])
  })

  it('move 换的是数组下标：新顺序落库，restore 之后仍是这个顺序', async () => {
    const widgets = useWidgets()
    const a = widgets.add('clock')
    const b = widgets.add('clock')
    if (!a.ok || !b.ok) throw new Error('前置失败')

    widgets.move(b.instance.id, 0)
    expect(widgets.renderable.map((i) => i.id)).toEqual([b.instance.id, a.instance.id])
    await flushed()
    expect((idbStore.get(KEY) as { id: string }[]).map((i) => i.id)).toEqual([
      b.instance.id,
      a.instance.id,
    ])

    const next = useWidgets()
    next.items = []
    await next.restore()
    expect(next.items.map((i) => i.id)).toEqual([b.instance.id, a.instance.id])
  })

  it('setPosition 只写 {col,row} 整数格：负坐标夹回 0；releasePosition 退回自动流式', async () => {
    const widgets = useWidgets()
    const res = widgets.add('clock')
    if (!res.ok) throw new Error('前置失败')

    widgets.setPosition(res.instance.id, { col: -3, row: 5 })
    expect(widgets.items[0].pos).toEqual({ col: 0, row: 5 })
    await flushed()
    expect((idbStore.get(KEY) as { pos: unknown }[])[0].pos).toEqual({ col: 0, row: 5 })

    widgets.releasePosition(res.instance.id)
    expect(widgets.items[0].pos).toBeNull()
    await flushed()
    expect((idbStore.get(KEY) as { pos: unknown }[])[0].pos).toBeNull()
  })

  it('restore 过 IDB 往返，丢掉手改过的非法条目', async () => {
    const widgets = useWidgets()
    widgets.add('clock')
    widgets.add('city', 'sm', { city: '巴黎' })
    await flushed()

    const saved = JSON.parse(JSON.stringify(idbStore.get(KEY))) as unknown[]
    saved.push(
      { id: 'x', kindId: 'ghost', size: 'md', pos: null, addedAt: 9 }, // kind 未注册
      { id: 'y', kindId: 'clock', size: 'huge', pos: null, addedAt: 8 }, // 非法尺寸 → default
      { id: 'z', kindId: 'clock', size: 'sm', pos: { col: -1, row: 0, anchor: 'br' }, addedAt: 7 }, // 负坐标 → null
      { id: 'p', kindId: 'clock', size: 'sm', pos: { col: 1, row: 2, anchor: 'br' }, addedAt: 6 },
      {
        id: 'w',
        kindId: 'city',
        size: 'md',
        pos: null,
        addedAt: 5,
        config: { city: '纽约', evil: 1 },
      },
      null,
      1,
      { id: 'noKind' },
    )
    idbStore.set(KEY, saved)

    const next = useWidgets()
    next.items = []
    await next.restore()

    const byId = Object.fromEntries(next.items.map((i) => [i.id, i]))
    expect(Object.keys(byId).sort()).toEqual(['p', 'w', 'wgt-city', 'wgt-clock', 'y', 'z'])
    expect(byId['y'].size).toBe('md') // 回退 defaultSize
    expect(byId['z'].pos).toBeNull() // 负坐标 → 退回自动流式
    // 右锚定整数网格：pos 只剩 {col,row}，老数据里的 anchor 键被 validCell 迁移时剥掉
    expect(byId['p'].pos).toEqual({ col: 1, row: 2 })
    expect(byId['w'].config).toEqual({ city: '纽约', format: '24h' })
  })

  it('restore 对损坏数据（非数组）保持空表而不抛错', async () => {
    idbStore.set(KEY, { nope: true })
    const widgets = useWidgets()
    await widgets.restore()
    expect(widgets.items).toEqual([])
  })

  it('首次运行（从未落库）按 manifest.seed 铺默认件并落库', async () => {
    const widgets = useWidgets()
    await widgets.restore()
    await flushed()

    expect(widgets.items.map((i) => i.kindId)).toEqual(['default-on'])
    expect(widgets.items[0]).toMatchObject({ id: 'wgt-default-on', size: 'sm', pos: null })
    expect(idbStore.get(KEY)).toEqual(widgets.items)
    // 补种只发生在「从没写过」这一次
    expect(widgets.renderable.map((i) => i.kindId)).toEqual(['default-on'])
  })

  it('落库为空数组（用户清空过）不再补种', async () => {
    idbStore.set(KEY, [])
    const widgets = useWidgets()
    await widgets.restore()
    expect(widgets.items).toEqual([])
  })

  it('kindState 缺省为「已安装 + 已启用」', () => {
    const widgets = useWidgets()
    expect(widgets.kindState('clock')).toEqual({ installed: true, enabled: true })
    expect(widgets.kindState('从没听说过的 kind')).toEqual({ installed: true, enabled: true })
  })

  it('卸载连带摘掉该 kind 的实例并记未安装，renderable 随之清空（两个键都落库）', async () => {
    const widgets = useWidgets()
    widgets.add('clock')
    widgets.add('clock')
    widgets.add('todos')
    await flushed()

    widgets.uninstall('clock')
    await flushed()

    expect(widgets.items.map((i) => i.kindId)).toEqual(['todos'])
    expect(widgets.kindState('clock')).toEqual({ installed: false, enabled: false })
    expect(widgets.renderable.map((i) => i.kindId)).toEqual(['todos'])
    expect(idbStore.get(KEY)).toEqual(widgets.items)
    expect(idbStore.get(KINDS_KEY)).toEqual({ clock: { installed: false, enabled: false } })
  })

  it('落库前还原纯数据：filter 重建过的数组（元素是响应式代理）也写得进 IDB', async () => {
    const widgets = useWidgets()
    widgets.add('clock')
    widgets.add('todos')
    await flushed()

    // uninstall 用 filter 重建数组；若落库前不剥掉响应式代理，真 IDB 会抛 DataCloneError
    widgets.uninstall('clock')
    await flushed()

    expect(idbStore.get(KEY)).toEqual([expect.objectContaining({ kindId: 'todos' })])
  })

  it('install 把卸载过的 kind 装回缺省态，实例不复活；未知 kind 不写记录', () => {
    const widgets = useWidgets()
    widgets.add('clock')
    widgets.uninstall('clock')

    widgets.install('clock')
    expect(widgets.kindState('clock')).toEqual({ installed: true, enabled: true })
    expect(widgets.items).toEqual([])

    widgets.install('nope')
    expect(widgets.kinds).not.toHaveProperty('nope')
  })

  it('setEnabled 只改启用态：renderable 留、visible 去，且落库', async () => {
    const widgets = useWidgets()
    widgets.add('clock')
    widgets.add('todos')
    await flushed()

    widgets.setEnabled('clock', false)
    await flushed()

    expect(widgets.renderable.map((i) => i.kindId)).toEqual(['clock', 'todos'])
    expect(widgets.visible.map((i) => i.kindId)).toEqual(['todos'])
    expect(widgets.kindState('clock')).toEqual({ installed: true, enabled: false })
    expect(idbStore.get(KINDS_KEY)).toEqual({ clock: { installed: true, enabled: false } })
  })

  it('restoreKinds 过 IDB 往返，丢弃已注销 kind 与非对象条目', async () => {
    const widgets = useWidgets()
    widgets.setEnabled('clock', false)
    await flushed()

    idbStore.set(KINDS_KEY, {
      ...(idbStore.get(KINDS_KEY) as Record<string, unknown>),
      ghost: { installed: false, enabled: false }, // kind 未注册
      city: 'nope', // 非对象
      todos: { installed: true, enabled: false },
    })

    const next = useWidgets()
    next.kinds = {}
    await next.restoreKinds()

    expect(next.kinds).toEqual({
      clock: { installed: true, enabled: false },
      todos: { installed: true, enabled: false },
    })
  })

  it('restoreKinds 对损坏数据（非对象/数组）保持空表', async () => {
    idbStore.set(KINDS_KEY, ['nope'])
    const widgets = useWidgets()
    await widgets.restoreKinds()
    expect(widgets.kinds).toEqual({})
  })
})
