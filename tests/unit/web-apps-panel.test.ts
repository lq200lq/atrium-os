import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import FeedbackHost from '@/shell/FeedbackHost.vue'
import WebAppsPanel from '@/apps/app-center/WebAppsPanel.vue'
import { useWebApps } from '@/kernel/stores/webApps'

const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))

vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value)
  }),
}))

function mountPanel() {
  // 面板 setup 里就取 useFeedback()，脱离宿主会抛——按真实壳层那样套一层 FeedbackHost
  return mount(FeedbackHost, { slots: { default: () => h(WebAppsPanel, { query: '' }) } })
}

async function clickText(wrapper: ReturnType<typeof mountPanel>, text: string, scope = '') {
  const root = scope ? wrapper.get(scope) : wrapper
  const btn = root.findAll('button').find((b) => b.text() === text)
  if (!btn) throw new Error(`前置失败：找不到按钮「${text}」`)
  await btn.trigger('click')
  await flushPromises()
  await nextTick()
}

/** 逐字段填：OsForm 的 setField 读的是尚未回流的 prop，同一拍里连写两个字段会互相覆盖 */
async function fill(wrapper: ReturnType<typeof mountPanel>, name: string, url: string) {
  const inputs = wrapper.findAll('[role="dialog"] input')
  await inputs[0].setValue(name)
  await inputs[1].setValue(url)
}

function fieldErrors(wrapper: ReturnType<typeof mountPanel>) {
  return wrapper.findAll('[role="dialog"] p.text-danger-text').map((p) => p.text())
}

async function openAndFill(wrapper: ReturnType<typeof mountPanel>, name: string, url: string) {
  await clickText(wrapper, '添加网页应用')
  await fill(wrapper, name, url)
  await clickText(wrapper, '确定')
}

describe('WebAppsPanel 网页应用管理', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('没有记录时给出空态与添加入口', () => {
    const wrapper = mountPanel()
    expect(wrapper.text()).toContain('共 0 个')
    expect(wrapper.text()).toContain('还没有网页应用')
  })

  it('javascript: 地址被字段错误拦下，文案取自语言包而不是 key', async () => {
    const wrapper = mountPanel()
    await openAndFill(wrapper, '示例', 'javascript:alert(1)')
    expect(fieldErrors(wrapper)).toContain('只支持 http/https 地址')
    expect(wrapper.get('[role="dialog"]').text()).not.toContain('webApp.reason')
    expect(useWebApps().items).toHaveLength(0)
  })

  // reason 值是 'too-long'，带连字符的语言包路径曾是写错的 tooLong：这条用例盯住路径真能取到词
  it('超长地址的拒绝原因解析到 webApp.reason.too-long', async () => {
    const wrapper = mountPanel()
    await openAndFill(wrapper, '示例', `https://example.com/${'a'.repeat(2100)}`)
    expect(fieldErrors(wrapper)).toContain('地址过长（上限 2048 字符）')
  })

  it('必填与名称长度上限由 OsForm 拦下', async () => {
    const wrapper = mountPanel()
    await clickText(wrapper, '添加网页应用')
    await fill(wrapper, '', '')
    await clickText(wrapper, '确定')
    expect(fieldErrors(wrapper)).toEqual(['名称不能为空', '地址不能为空'])

    await fill(wrapper, '名'.repeat(25), 'https://example.com')
    await clickText(wrapper, '确定')
    expect(fieldErrors(wrapper)).toEqual(['名称至多 24 个字符'])
  })

  it('合法地址入库、成行并落 IDB；卸载后列表清空', async () => {
    const wrapper = mountPanel()
    await openAndFill(wrapper, '示例站', 'example.com/a?b=1')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

    const store = useWebApps()
    expect(store.items).toHaveLength(1)
    expect(store.items[0]).toMatchObject({
      id: 'web-example-com',
      url: 'https://example.com/a?b=1',
    })
    expect(idbStore.get('webapps-v1')).toMatchObject([{ id: 'web-example-com' }])
    expect(wrapper.text()).toContain('共 1 个')
    expect(wrapper.text()).toContain('示例站')

    await clickText(wrapper, '卸载')
    // 确认弹窗里的同名按钮：不限定作用域会再点一次列表行的「卸载」
    await clickText(wrapper, '卸载', '[role="dialog"]')
    expect(store.items).toHaveLength(0)
    expect(idbStore.get('webapps-v1')).toEqual([])
    expect(wrapper.text()).toContain('共 0 个')
  })
})
