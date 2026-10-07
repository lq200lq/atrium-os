import { inject, onScopeDispose, ref, type Ref } from 'vue'
import { setSuspended, subscribeTick } from '../widget/scheduler'
import { WIDGET_PREVIEW_KEY } from './useWidgetContext'

/**
 * 显示层心跳：宿主级共享调度器 + 多订阅，页面隐藏整体挂起、回到前台补一次。
 * **组件内禁止自持 setInterval**（指南 §10 禁止事项）——加两个时钟实例不该多两个定时器。
 * 预览沙箱内不注册（预览是静态一帧），否则一屏十几行目录会挂出十几个秒级定时器。
 */
export function useWidgetTick(ms: number, onTick?: () => void): Ref<number> {
  const now = ref(Date.now())
  if (inject(WIDGET_PREVIEW_KEY, null)) return now

  const fire = () => {
    now.value = Date.now()
    onTick?.()
  }
  const unsubscribe = subscribeTick(ms, fire)

  const resume = () => setSuspended(document.hidden)
  document.addEventListener('visibilitychange', resume)
  resume()

  onScopeDispose(() => {
    document.removeEventListener('visibilitychange', resume)
    unsubscribe()
  })
  return now
}

/** 秒级/分钟级两档常用节奏，避免件里散写字面量 */
export const TICK_SECOND = 1000
export const TICK_HALF_MINUTE = 30_000
export const TICK_MINUTE = 60_000
