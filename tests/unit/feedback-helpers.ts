import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import FeedbackHost from '@/shell/FeedbackHost.vue'
import { useFeedback, type FeedbackApi } from '@/ui/feedback'

/**
 * 反馈上下文的挂载脚手架。
 *
 * 只定义**一个**消费方组件（`vue/one-component-per-file`），宿主与孤儿两种场景共用它：
 * - 挂在 `FeedbackHost` 的默认插槽里 → `useFeedback()` 拿到真实 API；
 * - 单独挂载 → `useFeedback()` 必须抛错（上下文缺失不退化成全局单例）。
 */
let sink: ((api: FeedbackApi) => void) | null = null

const Consumer = defineComponent({
  setup() {
    const api = useFeedback()
    sink?.(api)
    return () => h('span', '消费方')
  },
})

/** 在 FeedbackHost 子树里取到反馈 API（与真实应用同一条 inject 路径） */
export function mountFeedbackHost(into: (api: FeedbackApi) => void) {
  sink = into
  return mount(FeedbackHost, { slots: { default: () => h(Consumer) } })
}

/** 无宿主的孤儿消费方 */
export function mountOrphanConsumer() {
  sink = null
  return mount(Consumer)
}
