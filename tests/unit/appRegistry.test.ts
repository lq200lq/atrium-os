import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import { useAppRegistry, type AppManifest } from '@/kernel/stores/appRegistry'

const stubEntry = () => Promise.resolve({} as Component)

function manifest(id: string, extra: Partial<AppManifest> = {}): AppManifest {
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
})
