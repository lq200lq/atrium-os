import { useNotification } from '../stores/notification'
import { useErrorLog } from '../observability/errorLog'

/**
 * 数据层错误的统一落点：console.warn + 通知中心即时提示 + 错误日志留痕，不吞异常（仍由调用方 reject 后回滚）。
 * 推送在无活动 pinia（如裸单测）时静默降级，避免反噬业务流程。
 */
export function reportError(title: string, e: unknown): void {
  console.warn(`[data] ${title}`, e)
  try {
    useNotification().push(title, e instanceof Error ? e.message : String(e))
  } catch {
    /* 无活动 pinia 时仅保留 console.warn */
  }
  try {
    useErrorLog().capture({
      scope: 'data',
      message: `${title}: ${e instanceof Error ? e.message : String(e)}`,
    })
  } catch {
    /* 无活动 pinia 时跳过日志留痕 */
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
