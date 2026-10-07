import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import AiAssistant from '@/apps/ai-assistant/App.vue'
import { useVfs } from '@/kernel/stores/vfs'
import { i18n } from '@/i18n'
import { provideFeedback, type FeedbackApi } from '@/ui/feedback'

/**
 * AI 助手三态（开源标准轮 L7）：pending 指示、写入失败的错误消息 + 重试出口。
 * 应答时延是假时钟常量（App 内 SEND_DELAY/PLAN_DELAY），测试按同样时长推进。
 */

const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))
vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value)
  }),
}))

const t = (key: string, params?: Record<string, unknown>) =>
  (params ? i18n.global.t(key, params) : i18n.global.t(key)) as string

const stubFeedback: FeedbackApi = {
  notify: vi.fn(() => 1),
  success: vi.fn(() => 1),
  error: vi.fn(() => 1),
  warning: vi.fn(() => 1),
  info: vi.fn(() => 1),
  confirm: vi.fn(async () => true),
}

let wrapper: VueWrapper | null = null

async function mountApp() {
  await useVfs().init()
  // provide 只对后代可见：搭一层壳组件喂反馈上下文（useFeedback 的既有测试口径）
  const Shell = defineComponent({
    setup() {
      provideFeedback(stubFeedback)
      return () => h(AiAssistant)
    },
  })
  wrapper = mount(Shell, { attachTo: document.body })
  return wrapper
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  idbStore.clear()
  setActivePinia(createPinia())
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('AI 助手三态', () => {
  it('初始问候走 i18n 键（script 段 chrome 也不留硬编码）', async () => {
    const w = await mountApp()
    expect(w.text()).toContain(t('aiAssistant.greeting'))
  })

  it('send：pending 指示出现且输入动作被禁，到点收起并落回复', async () => {
    const w = await mountApp()
    const input = w.find('input')
    await input.setValue('今天天气如何')
    await input.trigger('keydown.enter')

    // pending：思考指示可见，发送与快捷指令一并禁用（防重复提交）
    expect(w.find('[role="status"]').text()).toBe(t('aiAssistant.thinking'))
    const sendBtn = w.findAll('button').find((b) => b.text() === t('aiAssistant.send'))!
    expect(sendBtn.attributes('disabled')).toBeDefined()

    await vi.advanceTimersByTimeAsync(300)
    expect(w.find('[role="status"]').exists()).toBe(false)
    expect(sendBtn.attributes('disabled')).toBeUndefined()
    expect(w.text()).toContain(t('aiAssistant.placeholderReply', { text: '今天天气如何' }))
  })

  it('pending 期间重复 send 不追加消息', async () => {
    const w = await mountApp()
    const input = w.find('input')
    await input.setValue('第一句')
    await input.trigger('keydown.enter')
    const bubbles = w.findAll('.max-w-\\[85\\%\\]').length
    // 直接再次触发（disabled 挡的是指针，函数自身也要守）
    await w.find('input').setValue('第二句')
    await w.find('input').trigger('keydown.enter')
    expect(w.findAll('.max-w-\\[85\\%\\]').length).toBe(bubbles)
    await vi.advanceTimersByTimeAsync(300)
  })

  it('生成方案：写入失败落错误消息与重试，重试成功落文档卡', async () => {
    const w = await mountApp()
    const vfs = useVfs()
    const spy = vi.spyOn(vfs, 'writeFile').mockImplementationOnce(() => {
      throw new Error('quota exceeded')
    })

    const quick = w.findAll('button').find((b) => b.text() === t('aiAssistant.quickPlan'))!
    await quick.trigger('click')
    await vi.advanceTimersByTimeAsync(400)

    // 失败态：错误消息 + 重试出口，且 pending 已收起
    expect(w.text()).toContain(t('aiAssistant.planFailed'))
    expect(w.find('[role="status"]').exists()).toBe(false)
    const retry = w.findAll('button').find((b) => b.text() === t('common.retry'))!
    expect(retry, '失败消息应带重试出口').toBeTruthy()

    await retry.trigger('click')
    await vi.advanceTimersByTimeAsync(400)

    // 成功态：错误消息被替换，文档卡出现，并发出成功通知
    expect(w.text()).not.toContain(t('aiAssistant.planFailed'))
    expect(w.text()).toContain(t('aiAssistant.planDone'))
    expect(w.text()).toContain('智慧园区数字化解决方案.docx')
    expect(stubFeedback.success).toHaveBeenCalledWith(
      t('aiAssistant.planSaved'),
      '智慧园区数字化解决方案.docx',
    )
    expect(spy.mock.calls.length).toBe(2)
  })
})
