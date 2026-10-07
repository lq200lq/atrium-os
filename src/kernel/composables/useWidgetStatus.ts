import { computed, watch, type ComputedRef } from 'vue'
import { useWidgetContext } from './useWidgetContext'
import { useWidgets } from '../stores/widgets'
import { useWidgetRuntime } from '../stores/widgetRuntime'

export interface WidgetStatus {
  /** 卡片当前真的画在桌面上（被溢出时 false） */
  visible: ComputedRef<boolean>
  /** 溢出的成因，供「为什么没显示」的文案 */
  overflow: ComputedRef<string | null>
  /** kind 被停用 */
  disabled: ComputedRef<boolean>
  /** 宿主最近一次让它取数的时刻（件内可显示「更新于 x 分钟前」，A-9） */
  lastRefreshAt: ComputedRef<number | null>
  /** 「立即刷新」计数：每次递增代表宿主请求过一次取数 */
  refreshCount: ComputedRef<number>
  /** 取数完成后回报时刻；无数据源的件不该调它 */
  markRefreshed(): void
  /** 挂一个刷新回调（等价于 watch refreshCount，但少一层样板） */
  onRefresh(handler: () => void): void
}

/** 时间与可见性不用自己发明（K2）：件靠它决定「该不该继续拉数据」 */
export function useWidgetStatus(): WidgetStatus {
  const { instanceId, kindId } = useWidgetContext()
  const store = useWidgets()
  const runtime = useWidgetRuntime()

  const placement = computed(() => runtime.placementOf(instanceId))
  const status: WidgetStatus = {
    visible: computed(() => placement.value.visible),
    overflow: computed(() => placement.value.overflow),
    disabled: computed(() => !store.kindState(kindId.value).enabled),
    lastRefreshAt: computed(() => runtime.lastRefreshAt[instanceId] ?? null),
    refreshCount: computed(() => runtime.refreshCount(instanceId)),
    markRefreshed: () => runtime.markRefreshed(instanceId),
    onRefresh: (handler: () => void) => {
      watch(
        () => runtime.refreshSignal[instanceId] ?? 0,
        (n, prev) => {
          if (n !== prev) handler()
        },
      )
    },
  }
  return status
}
