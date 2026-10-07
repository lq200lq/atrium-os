import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import DocEditor from '@/apps/doc-editor/App.vue'
import { WIN_ID_KEY } from '@/kernel/composables/useWindowContext'
import { useAppRegistry, type AppManifest } from '@/kernel/stores/appRegistry'
import { useVfs } from '@/kernel/stores/vfs'
import { useWindowManager } from '@/kernel/stores/windowManager'
import { i18n } from '@/i18n'

/**
 * 文档编辑器状态机（开源标准轮 L12，不入 coverage 地板、作回归腿）：
 * 关联加载、编辑中→防抖保存→已保存、缺失文件降级、无关联回落。
 */

const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))
vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value)
  }),
}))

const t = (key: string) => i18n.global.t(key) as string
const HOME = '/我的文件'
const FILE = `${HOME}/需求文档.docx`
const stubEntry = () => Promise.resolve({} as Component)

let wrapper: VueWrapper | null = null

async function mountEditor(payloadPath?: string) {
  const vfs = useVfs()
  await vfs.init()
  const registry = useAppRegistry()
  const manifest = {
    id: 'doc-editor',
    name: '文档编辑',
    icon: 'sparkles',
    window: { w: 600, h: 400 },
    entry: stubEntry,
  } as AppManifest
  registry.register(manifest)
  const winId = useWindowManager().open(
    'doc-editor',
    payloadPath !== undefined ? { path: payloadPath, key: payloadPath } : undefined,
  )
  if (!winId) throw new Error('前置失败：窗口未建立')
  const Shell = defineComponent({
    setup() {
      provide(WIN_ID_KEY, winId)
      return () => h(DocEditor)
    },
  })
  wrapper = mount(Shell, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('doc-editor 状态机', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    idbStore.clear()
    setActivePinia(createPinia())
    wrapper = null
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('关联已存在文件：标题与内容载入，呈编辑中态', async () => {
    const w = await mountEditor(FILE)
    expect(w.text()).toContain('需求文档.docx')
    expect(w.text()).toContain(t('docEditor.editing'))
    const area = w.get('textarea')
    expect((area.element as HTMLTextAreaElement).value.length).toBeGreaterThan(0)
  })

  it('输入触发防抖保存：编辑中 → 已保存，内容落 VFS', async () => {
    const w = await mountEditor(FILE)
    const area = w.get('textarea')
    await area.setValue('改过的正文')
    expect(w.text()).toContain(t('docEditor.editing'))
    expect(w.text()).not.toContain(t('docEditor.saved'))

    await vi.advanceTimersByTimeAsync(500)
    expect(w.text()).toContain(t('docEditor.saved'))
    expect(useVfs().byPath(FILE)?.content).toBe('改过的正文')
  })

  it('路径已失效：降级为缺失态，不给编辑面', async () => {
    const w = await mountEditor(`${HOME}/并不存在.docx`)
    expect(w.text()).toContain(t('docEditor.missing'))
    expect(w.text()).toContain(t('docEditor.noFile'))
    expect(w.find('textarea').exists()).toBe(false)
  })

  it('无关联 payload：标题回落未关联文件，仍可编辑', async () => {
    const w = await mountEditor(undefined)
    expect(w.text()).toContain(t('docEditor.noFile'))
    expect(w.find('textarea').exists()).toBe(true)
  })
})
