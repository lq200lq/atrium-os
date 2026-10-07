import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import { useSession } from '@/kernel/stores/session'
import { useWidgetRegistry, type WidgetManifest } from '@/kernel/stores/widgetRegistry'

// setUser 会走 session.persist；happy-dom 无 indexedDB，用内存 Map 顶掉以保持输出干净
const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))

vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value)
  }),
}))

const stubEntry = () => Promise.resolve({} as Component)

function manifest(id: string, extra: Partial<WidgetManifest> = {}): WidgetManifest {
  return {
    id,
    name: id,
    icon: 'sparkles',
    entry: stubEntry,
    widget: { sizes: ['sm', 'md'] },
    ...extra,
  }
}

describe('widgetRegistry 注册契约与排序', () => {
  beforeEach(() => {
    idbStore.clear()
    setActivePinia(createPinia())
  })

  it('重复 id 只注册一次', () => {
    const registry = useWidgetRegistry()
    registry.register(manifest('a'))
    registry.register(manifest('a'))
    expect(registry.widgets).toHaveLength(1)
  })

  it('按 order 升序排列，与注册顺序无关', () => {
    const registry = useWidgetRegistry()
    registry.register(manifest('late', { order: 90 }))
    registry.register(manifest('early', { order: 10 }))
    registry.register(manifest('mid', { order: 50 }))
    expect(registry.widgets.map((w) => w.id)).toEqual(['early', 'mid', 'late'])
  })

  it('缺省 order 视为 100，同权重保持先注册在前', () => {
    const registry = useWidgetRegistry()
    registry.register(manifest('first'))
    registry.register(manifest('second'))
    registry.register(manifest('pinned', { order: 5 }))
    expect(registry.widgets.map((w) => w.id)).toEqual(['pinned', 'first', 'second'])
  })

  it('注册即把 entry 包成懒加载异步组件（壳层不关心加载时机）', () => {
    const registry = useWidgetRegistry()
    registry.register(manifest('a'))
    const component = registry.byId('a')?.component as unknown as
      { __asyncLoader?: unknown } | undefined
    expect(component).toBeTruthy()
    expect(typeof component?.__asyncLoader).toBe('function')
  })

  it('accessibleWidgets 按权限过滤：无权限的小组件不出现在派生入口', () => {
    const registry = useWidgetRegistry()
    registry.register(manifest('public', { order: 1 }))
    registry.register(manifest('gated', { order: 2, permissions: ['widget:secret'] }))
    expect(registry.accessibleWidgets.map((w) => w.id)).toEqual(['public', 'gated'])

    useSession().setUser('guest')
    expect(registry.accessibleWidgets.map((w) => w.id)).toEqual(['public'])
    // 过滤只作用于派生入口，注册表本体不动
    expect(registry.byId('gated')).toBeTruthy()
  })

  it('unregister 摘掉小组件，不影响其它项顺序', () => {
    const registry = useWidgetRegistry()
    registry.register(manifest('a', { order: 10 }))
    registry.register(manifest('b', { order: 20 }))
    registry.register(manifest('c', { order: 30 }))
    registry.unregister('b')
    expect(registry.widgets.map((w) => w.id)).toEqual(['a', 'c'])
    expect(registry.byId('b')).toBeUndefined()
    registry.unregister('nope') // 幂等：摘不存在的不抛错
    expect(registry.widgets).toHaveLength(2)
  })
})

describe('WidgetManifest 编译期契约', () => {
  it('缺 entry 不是合法 manifest', () => {
    // @ts-expect-error entry 是唯一渲染入口，缺失则无从取得组件
    const bad: WidgetManifest = { id: 'x', name: 'x', icon: 'sparkles', widget: { sizes: ['sm'] } }
    expect(bad).toBeTruthy()
  })

  it('缺 widget.sizes 不是合法 manifest', () => {
    // @ts-expect-error 尺寸档是小组件独有的能力声明，必须在 manifest 里给出
    const bad: WidgetManifest = { id: 'x', name: 'x', icon: 'sparkles', entry: stubEntry }
    expect(bad).toBeTruthy()
  })
})
