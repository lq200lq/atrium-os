import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import { useAppRegistry, type AppManifest } from '@/kernel/stores/appRegistry'

const stubEntry = () => Promise.resolve({} as Component)

/**
 * defineAsyncComponent 的内部装载器：用它验证「embed 合成出来的到底是哪个组件」，
 * 否则断言只能停在 component 非空，等于没测。
 */
function asyncLoaderOf(component: unknown): Promise<{ __name?: string }> {
  const loader = (component as { __asyncLoader?: () => Promise<{ __name?: string }> })
    ?.__asyncLoader
  if (!loader) throw new Error('注册出来的不是异步组件')
  return loader()
}

/** 只取 entry 那一支，避免 Partial<AppManifest> 把 embed 带进交叉结果 */
type EntryManifest = Extract<AppManifest, { entry: unknown }>

function manifest(id: string, extra: Partial<EntryManifest> = {}): AppManifest {
  return { id, name: id, icon: 'file', entry: stubEntry, window: { w: 400, h: 300 }, ...extra }
}

describe('appRegistry 注册契约与排序', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('重复 id 只注册一次', () => {
    const registry = useAppRegistry()
    registry.register(manifest('a'))
    registry.register(manifest('a'))
    expect(registry.apps).toHaveLength(1)
  })

  it('按 order 升序排列，与注册顺序无关', () => {
    const registry = useAppRegistry()
    registry.register(manifest('late', { order: 90 }))
    registry.register(manifest('early', { order: 10 }))
    registry.register(manifest('mid', { order: 50 }))
    expect(registry.apps.map((a) => a.id)).toEqual(['early', 'mid', 'late'])
  })

  it('缺省 order 视为 100，同权重保持先注册在前', () => {
    const registry = useAppRegistry()
    registry.register(manifest('first'))
    registry.register(manifest('second'))
    registry.register(manifest('pinned', { order: 5 }))
    expect(registry.apps.map((a) => a.id)).toEqual(['pinned', 'first', 'second'])
  })

  it('dockApps 过滤 dock:false 且沿用 order 排序', () => {
    const registry = useAppRegistry()
    registry.register(manifest('hidden', { dock: false, order: 1 }))
    registry.register(manifest('shown', { order: 2 }))
    expect(registry.dockApps.map((a) => a.id)).toEqual(['shown'])
  })

  it('dockAnchors/dockRest 按 manifest.dockAnchor 分组且互补覆盖全部 Dock 应用', () => {
    const registry = useAppRegistry()
    registry.register(manifest('launcher', { order: 40, dockAnchor: true }))
    registry.register(manifest('a', { order: 10 }))
    registry.register(manifest('b', { order: 20 }))
    registry.register(manifest('off', { order: 1, dock: false }))
    expect(registry.dockAnchors.map((a) => a.id)).toEqual(['launcher'])
    expect(registry.dockRest.map((a) => a.id)).toEqual(['a', 'b'])
  })

  it('embed 类目没有 entry，注册时合成内置 EmbedView', async () => {
    const registry = useAppRegistry()
    registry.register({
      id: 'web',
      name: '网页应用',
      icon: 'globe',
      embed: { url: 'https://example.com/' },
      window: { w: 900, h: 620 },
    })
    const app = registry.byId('web')
    expect(app?.embed).toEqual({ url: 'https://example.com/' })
    // 渲染面只有一条路径：embed 与 entry 应用都拿到 component，壳层不需要认识 iframe
    expect(app?.component).toBeTruthy()
    const resolved = await asyncLoaderOf(app?.component)
    expect(resolved.__name).toBe('EmbedView')
  })

  it('unregister 摘掉应用，不影响其它项顺序', () => {
    const registry = useAppRegistry()
    registry.register(manifest('a', { order: 10 }))
    registry.register(manifest('b', { order: 20 }))
    registry.register(manifest('c', { order: 30 }))
    registry.unregister('b')
    expect(registry.apps.map((a) => a.id)).toEqual(['a', 'c'])
    expect(registry.byId('b')).toBeUndefined()
    registry.unregister('nope') // 幂等：摘不存在的不抛错
    expect(registry.apps).toHaveLength(2)
  })
})

describe('AppManifest 的 entry/embed 互斥（编译期契约）', () => {
  const asManifest = (m: AppManifest) => m

  it('两者同时给出不是合法 manifest', () => {
    // @ts-expect-error entry 与 embed 二选一，同时给是契约错误
    const bad: AppManifest = {
      id: 'both',
      name: 'both',
      icon: 'file',
      entry: stubEntry,
      embed: { url: 'https://example.com/' },
      window: { w: 1, h: 1 },
    }
    expect(bad).toBeTruthy()
  })

  it('两者都不给不是合法 manifest', () => {
    // @ts-expect-error 既无 entry 也无 embed，渲染面无从取得组件
    const none: AppManifest = { id: 'x', name: 'x', icon: 'file', window: { w: 1, h: 1 } }
    expect(none).toBeTruthy()
  })

  it('单侧写法各自合法（正向对照，避免互斥断言变成永真）', () => {
    expect(
      asManifest({ id: 'a', name: 'a', icon: 'file', entry: stubEntry, window: { w: 1, h: 1 } }),
    ).toBeTruthy()
    expect(
      asManifest({
        id: 'b',
        name: 'b',
        icon: 'file',
        embed: { url: '/x.html' },
        window: { w: 1, h: 1 },
      }),
    ).toBeTruthy()
  })
})
