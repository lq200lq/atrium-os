import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import Spotlight from '@/shell/Spotlight.vue'
import { useAppRegistry, type AppManifest } from '@/kernel/stores/appRegistry'
import { useShellUi } from '@/kernel/stores/shellUi'
import { useVfs } from '@/kernel/stores/vfs'
import { useWindowManager } from '@/kernel/stores/windowManager'
import { i18n } from '@/i18n'

const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))
vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value)
  }),
}))

const stubEntry = () => Promise.resolve({} as Component)
const t = (key: string) => i18n.global.t(key) as string

function register(id: string, extra: Partial<AppManifest> = {}) {
  useAppRegistry().register({
    id,
    name: id,
    icon: 'sparkles',
    window: { w: 400, h: 300 },
    entry: stubEntry,
    ...extra,
  } as AppManifest)
}

let wrapper: VueWrapper | null = null

async function openSpotlight() {
  wrapper = mount(Spotlight, { attachTo: document.body })
  useShellUi().openSpotlight()
  await nextTick()
  await nextTick()
  return wrapper
}

describe('Spotlight', () => {
  beforeEach(() => {
    idbStore.clear()
    setActivePinia(createPinia())
    register('demo-app', { name: '演示应用', keywords: ['demo'] })
    wrapper = null
  })

  it('关闭时无节点；打开后输入框拿到焦点并复位查询', async () => {
    wrapper = mount(Spotlight)
    expect(wrapper.find('input').exists()).toBe(false)

    const w = await openSpotlight()
    const input = w.get('input')
    expect(input.attributes('placeholder')).toBe(t('spotlight.placeholder'))
    expect(document.activeElement).toBe(input.element)
  })

  it('空查询列出应用与文件，查询串过滤，无命中给空态', async () => {
    await useVfs().init()
    const w = await openSpotlight()
    const input = w.get('input')

    // 空查询：应用 + 种子文件都进结果（上限 12）
    const all = w.findAll('ul li button')
    expect(all.length).toBeGreaterThan(1)
    expect(w.text()).toContain('演示应用')
    expect(w.text()).toContain('需求文档.docx')

    // 过滤到只剩演示应用
    await input.setValue('demo-app')
    await nextTick()
    expect(w.findAll('ul li button')).toHaveLength(1)
    expect(w.text()).toContain('演示应用')

    // 无命中空态
    await input.setValue('绝无此词xyz')
    await nextTick()
    expect(w.text()).toContain(t('spotlight.noResult'))
  })

  it('方向键移动光标（aria-current 跟随），Enter 打开当前项并收起浮层', async () => {
    const w = await openSpotlight()
    const input = w.get('input')
    await input.setValue('demo-app')
    await nextTick()

    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'ArrowUp' }) // 回绕到 0
    const first = w.get('ul li button')
    expect(first.attributes('aria-current')).toBe('true')

    await input.trigger('keydown', { key: 'Enter' })
    expect(useWindowManager().windows.some((x) => x.appId === 'demo-app')).toBe(true)
    expect(useShellUi().spotlightOpen).toBe(false)
  })

  it('Escape 收起浮层', async () => {
    const w = await openSpotlight()
    await w.get('input').trigger('keydown', { key: 'Escape' })
    expect(useShellUi().spotlightOpen).toBe(false)
  })
})
