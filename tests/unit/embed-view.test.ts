import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import EmbedView from '@/windows/EmbedView.vue'
import { WIN_ID_KEY } from '@/kernel/composables/useWindowContext'
import { useAppRegistry } from '@/kernel/stores/appRegistry'
import { useWindowManager } from '@/kernel/stores/windowManager'

vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async () => undefined),
  idbSet: vi.fn(async () => {}),
}))

// 逐字锁死：这两串是决策 D2′ 记在文档里的沙箱口径，改一个字都该让测试红
const SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-presentation'
const ALLOW = 'fullscreen; clipboard-read; clipboard-write; autoplay'

function mountEmbed(url: string) {
  const registry = useAppRegistry()
  registry.register({
    id: 'web-test',
    name: '测试站',
    icon: 'globe',
    embed: { url },
    window: { w: 900, h: 620 },
  })
  const winId = useWindowManager().open('web-test')
  if (!winId) throw new Error('前置失败：窗口未打开')
  return mount(EmbedView, { global: { provide: { [WIN_ID_KEY]: winId } } })
}

describe('EmbedView 外部网页应用渲染', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('挂载即渲染 iframe，src/sandbox/allow/title 按口径落地', () => {
    const wrapper = mountEmbed('https://example.com/')
    const frame = wrapper.find('iframe')
    expect(frame.exists()).toBe(true)
    expect(frame.attributes('src')).toBe('https://example.com/')
    expect(frame.attributes('sandbox')).toBe(SANDBOX)
    expect(frame.attributes('allow')).toBe(ALLOW)
    // frame-title：无 title 的 iframe 是 axe 的确定性违规
    expect(frame.attributes('title')).toBe('测试站')
    expect(frame.classes()).toContain('block')
  })

  it('沙箱不给 allow-top-navigation（拦 frame-busting 的唯一真防线）', () => {
    const wrapper = mountEmbed('https://example.com/')
    expect(wrapper.find('iframe').attributes('sandbox')).not.toContain('allow-top-navigation')
  })

  it('load 前是加载遮罩，load 后遮罩撤掉', async () => {
    const wrapper = mountEmbed('https://example.com/')
    expect(wrapper.text()).toContain('正在加载')

    await wrapper.find('iframe').trigger('load')
    expect(wrapper.text()).not.toContain('正在加载')
    // 超时计时不能在第 8 秒再把已就绪的窗口翻成超时
    vi.advanceTimersByTime(9000)
    expect(wrapper.text()).not.toContain('加载超时')
  })

  it('8 秒未 load 落到超时态，给重试与新标签页两个出口', async () => {
    const wrapper = mountEmbed('https://slow.example.com/')
    await vi.advanceTimersByTimeAsync(8000)
    expect(wrapper.text()).toContain('加载超时')
    expect(wrapper.text()).toContain('禁止被嵌入')
    const buttons = wrapper.findAll('button').map((b) => b.text())
    expect(buttons).toEqual(['重试', '新标签页打开', '重试', '新标签页打开'])
  })

  it('点重试重挂 iframe 并重新计时（跨源无法 reload）', async () => {
    const wrapper = mountEmbed('https://example.com/a')
    const first = wrapper.find('iframe').element
    await vi.advanceTimersByTimeAsync(8000)
    expect(wrapper.text()).toContain('加载超时')

    await wrapper
      .findAll('button')
      .find((b) => b.text() === '重试')!
      .trigger('click')
    expect(wrapper.text()).not.toContain('加载超时')
    expect(wrapper.find('iframe').element).not.toBe(first) // :key 换实例
    await vi.advanceTimersByTimeAsync(7999)
    expect(wrapper.text()).not.toContain('加载超时')
    await vi.advanceTimersByTimeAsync(1)
    expect(wrapper.text()).toContain('加载超时')
  })

  it('error 事件落到失败态', async () => {
    const wrapper = mountEmbed('https://example.com/')
    await wrapper.find('iframe').trigger('error')
    expect(wrapper.text()).toContain('加载失败')
    expect(wrapper.text()).not.toContain('加载超时')
  })

  it('新标签页出口用 window.open 打开原地址', async () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    const wrapper = mountEmbed('https://example.com/deep/path')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === '新标签页打开')!
      .trigger('click')
    expect(open).toHaveBeenCalledWith('https://example.com/deep/path', '_blank', 'noopener')
    vi.unstubAllGlobals()
  })

  it('同源相对入口照渲染（相对地址只属于内置 manifest），工具栏显示本站 host', () => {
    const wrapper = mountEmbed('/docs/index.html')
    expect(wrapper.find('iframe').attributes('src')).toBe('/docs/index.html')
    expect(wrapper.text()).toContain('localhost') // happy-dom 默认 origin
    expect(wrapper.text()).not.toContain('地址无效')
  })

  it('地址为空时不挂 iframe，只给空态', () => {
    const wrapper = mountEmbed('   ')
    expect(wrapper.find('iframe').exists()).toBe(false)
    expect(wrapper.text()).toContain('地址无效')
    expect(wrapper.text()).not.toContain('正在加载')
  })
})
