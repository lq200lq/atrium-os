import { inject, provide, type InjectionKey } from 'vue'
import type { NoticeAction, NoticeLevel } from '@/kernel/stores/notification'

/**
 * 命令式反馈入口的契约层。
 *
 * 走 **provide/inject 上下文**而不是模块级单例：通知与确认框归属于挂载它们的那棵组件树
 * （壳层），未挂载的上下文里调用即报错——antd 静态 `message.*` 读不到 `ConfigProvider`
 * 上下文那类问题不在这里重演。通知状态仍复用 `useNotification` store，不另起一套系统。
 */
export type FeedbackLevel = NoticeLevel

export interface NotifyOptions {
  title: string
  body?: string
  level?: FeedbackLevel
  /** 附带的跳转动作（点击后进对应应用），与通知中心共用一套语义 */
  action?: NoticeAction
}

export interface ConfirmOptions {
  title: string
  content?: string
  okText?: string
  cancelText?: string
}

export interface FeedbackApi {
  /** 通用入口，返回该条通知的 id */
  notify(options: NotifyOptions): number
  success(title: string, body?: string): number
  error(title: string, body?: string): number
  warning(title: string, body?: string): number
  info(title: string, body?: string): number
  /** resolve true=确认，false=取消；同一时刻只呈现最后发起的那一个 */
  confirm(options: ConfirmOptions): Promise<boolean>
}

const FEEDBACK_KEY: InjectionKey<FeedbackApi> = Symbol('os-feedback')

export const provideFeedback = (api: FeedbackApi) => provide(FEEDBACK_KEY, api)

export function useFeedback(): FeedbackApi {
  const api = inject(FEEDBACK_KEY, null)
  if (!api) {
    throw new Error(
      '[useFeedback] 未找到反馈上下文：需在壳层挂载 FeedbackHost，测试里自行 provideFeedback()',
    )
  }
  return api
}
