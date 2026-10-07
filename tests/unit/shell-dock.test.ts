import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import Dock from '@/shell/Dock.vue'
import { useAppRegistry, type AppManifest } from '@/kernel/stores/appRegistry'
import { useWindowManager } from '@/kernel/stores/windowManager'

/** 异步入口的落地物：open() 只创建窗口状态，不实例化组件，空渲染足够 */
const stubEntry = () => Promise.resolve({} as Component)

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

describe('Dock', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('锚定组在前、常规组在后，两组之间才画分隔线', () => {
    register('anchor-app', { name: '锚定应用', dockAnchor: true })
    register('plain-a', { name: '常规甲' })
    register('plain-b', { name: '常规乙' })
    const w = mount(Dock)

    const buttons = w.findAll('nav button')
    expect(buttons.map((b) => b.attributes('title'))).toEqual(['锚定应用', '常规甲', '常规乙'])
    // 分隔线只在组间：1 条，且带 aria-hidden
    const dividers = w.findAll('[data-dock-divider]')
    expect(dividers).toHaveLength(1)
    expect(dividers[0].attributes('aria-hidden')).toBe('true')
  })

  it('点击开窗 → 运行指示点亮 → 活动窗口再点最小化 → 再点还原', async () => {
    register('plain-a', { name: '常规甲' })
    const w = mount(Dock)
    const btn = w.get('nav button')

    await btn.trigger('click')
    const wm = useWindowManager()
    expect(wm.windows).toHaveLength(1)
    expect(wm.windows[0].status).toBe('normal')
    // 运行指示点出现
    expect(w.find('span.rounded-full').exists()).toBe(true)

    // 活动且 normal：再点 = 最小化
    await btn.trigger('click')
    expect(wm.windows[0].status).toBe('minimized')

    // 已无活动窗口：再点 = 还原最小化的那个（不开新窗）
    await btn.trigger('click')
    expect(wm.windows).toHaveLength(1)
    expect(wm.windows[0].status).toBe('normal')
  })

  it('窗口全部关闭后运行指示点消失', async () => {
    register('plain-a', { name: '常规甲' })
    const w = mount(Dock)
    await w.get('nav button').trigger('click')
    expect(w.find('span.rounded-full').exists()).toBe(true)
    useWindowManager().close(useWindowManager().windows[0].id)
    await w.vm.$nextTick()
    expect(w.find('span.rounded-full').exists()).toBe(false)
  })
})
