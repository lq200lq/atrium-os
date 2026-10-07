import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import FileManager from '@/apps/file-manager/App.vue'
import { WIN_ID_KEY } from '@/kernel/composables/useWindowContext'
import { useAppRegistry, type AppManifest } from '@/kernel/stores/appRegistry'
import { useVfs } from '@/kernel/stores/vfs'
import { useWindowManager } from '@/kernel/stores/windowManager'
import { provideFeedback, type FeedbackApi } from '@/ui/feedback'
import { i18n } from '@/i18n'

/**
 * 文件管理器状态机（开源标准轮 L12，不入 coverage 地板、作回归腿）：
 * 初始加载、新建目录、删除（确认+落回收站）、回收站还原、payload 下钻选中。
 * 覆盖率口径见 vitest.config.ts 注释：apps 层的地板腿以 e2e 为主，本文件保状态机不失守。
 */

const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))
vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value)
  }),
}))

const t = (key: string, params?: Record<string, unknown>) =>
  params ? (i18n.global.t(key, params) as string) : (i18n.global.t(key) as string)

const stubFeedback: FeedbackApi = {
  notify: vi.fn(() => 1),
  success: vi.fn(() => 1),
  error: vi.fn(() => 1),
  warning: vi.fn(() => 1),
  info: vi.fn(() => 1),
  confirm: vi.fn(async () => true),
}

const HOME = '/我的文件'
const FILE = `${HOME}/需求文档.docx`

let wrapper: VueWrapper | null = null

async function mountApp(payloadPath?: string) {
  const vfs = useVfs()
  await vfs.init()
  const registry = useAppRegistry()
  const stub = (id: string): AppManifest =>
    ({
      id,
      name: id,
      icon: 'sparkles',
      window: { w: 400, h: 300 },
      entry: () => Promise.resolve({} as never),
    }) as AppManifest
  registry.register(stub('file-manager'))
  registry.register(stub('doc-editor'))
  const winId = useWindowManager().open(
    'file-manager',
    payloadPath ? { path: payloadPath, key: payloadPath } : undefined,
  )
  if (!winId) throw new Error('前置失败：窗口未建立')

  const Shell = defineComponent({
    setup() {
      provideFeedback(stubFeedback)
      provide(WIN_ID_KEY, winId)
      return () => h(FileManager)
    },
  })
  wrapper = mount(Shell, { attachTo: document.body })
  await flushPromises()
  await flushPromises()
  return wrapper
}

function rows(w: VueWrapper) {
  return w.findAll('tbody tr')
}

async function clickButton(w: VueWrapper, label: string) {
  const btn = w.findAll('button').find((b) => b.text().trim() === label)
  expect(btn, `应有按钮「${label}」`).toBeTruthy()
  await btn!.trigger('click')
  await flushPromises()
  return btn!
}

describe('file-manager 状态机', () => {
  beforeEach(() => {
    idbStore.clear()
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.mocked(stubFeedback.confirm).mockResolvedValue(true)
    wrapper = null
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('初始加载：种子行进表，四列表头走 i18n', async () => {
    const w = await mountApp()
    expect(rows(w).length).toBeGreaterThan(0)
    const head = w.find('thead').text()
    for (const col of [
      t('fileManager.name'),
      t('fileManager.kind'),
      t('fileManager.size'),
      t('fileManager.updated'),
    ]) {
      expect(head, `表头应有「${col}」`).toContain(col)
    }
    // 需求文档在首屏行里
    expect(w.text()).toContain('需求文档.docx')
  })

  it('新建目录：默认名进对话框，确认后新行落表', async () => {
    const w = await mountApp()
    await clickButton(w, t('fileManager.newDir'))
    expect(w.text()).toContain(t('fileManager.newDir')) // 对话框标题
    const confirm = w.findAll('button').find((b) => b.text().trim() === t('common.confirm'))
    await confirm!.trigger('click')
    await flushPromises()
    expect(rows(w).some((r) => r.text().includes('新建目录'))).toBe(true)
  })

  it('删除：确认后落回收站，回收站里可还原', async () => {
    // payload 直达选中该文件，绕开表格勾选交互
    const w = await mountApp(FILE)
    await clickButton(w, t('common.delete'))
    expect(stubFeedback.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: t('fileManager.trashTitle') }),
    )
    expect(stubFeedback.success).toHaveBeenCalledWith(t('fileManager.trashed'), '需求文档.docx')
    expect(rows(w).some((r) => r.text().includes('需求文档.docx'))).toBe(false)

    // 进回收站：删掉的文件在，且还原按钮在
    const vfs = useVfs()
    expect(vfs.trash.some((n) => n.name === '需求文档.docx')).toBe(true)
    const trashTree = w
      .findAll('button, [role="treeitem"]')
      .find((el) => el.text().includes('回收站'))
    await trashTree!.trigger('click')
    await flushPromises()
    const trashRow = rows(w).find((r) => r.text().includes('需求文档.docx'))
    expect(trashRow, '回收站里应有被删文件').toBeTruthy()
    // 进回收站后选中态已清空，还原前先勾选该行
    await trashRow!.find('input[type="checkbox"]')!.setValue(true)
    await flushPromises()
    await clickButton(w, t('fileManager.restore'))
    expect(vfs.byPath(FILE)?.type).toBe('file')
    expect(vfs.trash.some((n) => n.name === '需求文档.docx')).toBe(false)
  })

  it('payload 下钻：直达路径选中该行（删除按钮因此可用）', async () => {
    const w = await mountApp(FILE)
    const del = w.findAll('button').find((b) => b.text().trim() === t('common.delete'))
    expect(del?.attributes('disabled')).toBeUndefined()
  })

  it('空目录：空态文案走 i18n', async () => {
    const vfs = await (async () => {
      const v = useVfs()
      await v.init()
      return v
    })()
    void vfs
    const w = await mountApp()
    // 新建一个空目录并进去
    await clickButton(w, t('fileManager.newDir'))
    const confirm = w.findAll('button').find((b) => b.text().trim() === t('common.confirm'))
    await confirm!.trigger('click')
    await flushPromises()
    const dirRow = rows(w).find((r) => r.text().includes('新建目录'))
    await dirRow!.trigger('dblclick')
    await flushPromises()
    expect(w.text()).toContain(t('fileManager.emptyDir'))
  })
})
