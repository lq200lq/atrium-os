import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import Settings from '@/apps/settings/App.vue'
import { WIN_ID_KEY } from '@/kernel/composables/useWindowContext'
import { useAppRegistry, type AppManifest } from '@/kernel/stores/appRegistry'
import { useSession } from '@/kernel/stores/session'
import { useTheme } from '@/kernel/stores/theme'
import { useWindowManager } from '@/kernel/stores/windowManager'
import { useErrorLog } from '@/kernel/observability/errorLog'
import { i18n, setLocale } from '@/i18n'

/**
 * 设置应用状态机（开源标准轮 L12，不入 coverage 地板、作回归腿）：
 * 六段渲染、系统信息（许可/仓库）、payload 段落点（挂载即滚+高亮）、
 * 语言/主题切换、用户切换、诊断日志清空、关闭全部窗口。
 */

const stubEntry = () => Promise.resolve({} as Component)
const t = (key: string) => i18n.global.t(key) as string

let wrapper: VueWrapper | null = null
let scrollSpy: ReturnType<typeof vi.fn> | null = null
async function mountSettings(payload?: { section: string }) {
  const registry = useAppRegistry()
  const stub = (id: string, roles?: string[]): AppManifest =>
    ({
      id,
      name: id,
      icon: 'sparkles',
      window: { w: 400, h: 300 },
      entry: stubEntry,
      roles,
    }) as AppManifest
  registry.register(stub('app-center'))
  registry.register(stub('admin-only-app', ['admin']))
  // 落点测试要真实窗口（payload 在挂载前就位）；无 payload 时给缺失 id 走可选链
  let provided = 'win-missing'
  if (payload) {
    const id = useWindowManager().open('app-center', payload)
    if (!id) throw new Error('前置失败：窗口未建立')
    provided = id
  }
  const Shell = defineComponent({
    setup() {
      provide(WIN_ID_KEY, provided)
      return () => h(Settings)
    },
  })
  wrapper = mount(Shell, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

async function clickButton(w: VueWrapper, label: string) {
  const btn = w.findAll('button').find((b) => b.text().trim() === label)
  expect(btn, `应有按钮「${label}」`).toBeTruthy()
  await btn!.trigger('click')
  await flushPromises()
  return btn!
}

describe('settings 状态机', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const proto = Element.prototype as unknown as { scrollIntoView?: unknown }
    scrollSpy = vi.fn()
    proto.scrollIntoView = scrollSpy
    wrapper = null
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    // 语言/主题是全局态：还原，避免污染同文件后续用例
    setLocale('zh-CN')
    useTheme().setMode('light')
    const proto = Element.prototype as unknown as { scrollIntoView?: unknown }
    delete proto.scrollIntoView
  })

  it('六段齐全，系统信息含版本/许可证/源码仓库', async () => {
    const w = await mountSettings()
    for (const title of [
      t('settings.appearance.title'),
      t('settings.diagnostics.title'),
      t('settings.system.title'),
    ]) {
      expect(w.text(), `应有段「${title}」`).toContain(title)
    }
    expect(w.text()).toContain('Apache-2.0')
    const repo = w.get('[data-section="system"] a')
    expect(repo.attributes('href')).toBe('https://github.com/lq200lq/atrium-os')
    expect(w.text()).toContain(__APP_VERSION__)
  })

  it('payload 段落点：挂载即滚进视口并一次性高亮', async () => {
    const w = await mountSettings({ section: 'system' })
    expect(scrollSpy).toHaveBeenCalled()
    const system = w.get('[data-section="system"]')
    expect(system.classes()).toContain('bg-accent-soft')
  })

  it('语言切到英文：界面文案即时跟随', async () => {
    const w = await mountSettings()
    expect(w.text()).toContain(t('settings.system.title'))
    const en = w.find('input[name="app-lang"][value="en-US"]')
    await en.setValue(true)
    await flushPromises()
    expect(i18n.global.locale.value).toBe('en-US')
    expect(w.text()).toContain('System')
  })

  it('主题切到暗色：根元素 data-theme 落位', async () => {
    const w = await mountSettings()
    await w.find('input[name="theme-mode"][value="dark"]').setValue(true)
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(useTheme().mode).toBe('dark')
  })

  it('用户切换：当前用户随点击变化', async () => {
    const w = await mountSettings()
    expect(useSession().currentUserId).toBe('admin')
    const editor = w
      .findAll('button')
      .find((b) => b.text().includes(t('settings.users.editor.name')))
    expect(editor, '应有编辑者用户卡').toBeTruthy()
    await editor!.trigger('click')
    expect(useSession().currentUserId).toBe('editor')
  })

  it('诊断日志：有条目可清空，清空后按钮禁用', async () => {
    const w = await mountSettings()
    const log = useErrorLog()
    log.entries.unshift({ id: 1, ts: Date.now(), scope: 'app', message: '验收错误' })
    await flushPromises()
    expect(w.text()).toContain('验收错误')

    await clickButton(w, t('settings.diagnostics.clear'))
    expect(log.entries).toHaveLength(0)
    const clear = w
      .findAll('button')
      .find((b) => b.text().trim() === t('settings.diagnostics.clear'))
    expect(clear!.attributes('disabled')).toBeDefined()
  })

  it('关闭全部窗口：既开的窗口被清', async () => {
    const w = await mountSettings() // 先挂载（注册 stub 应用），再开窗
    const wm = useWindowManager()
    wm.open('app-center')
    expect(wm.windows.length).toBeGreaterThan(0)
    await clickButton(w, t('settings.window.closeAll'))
    expect(wm.windows).toHaveLength(0)
  })
})
