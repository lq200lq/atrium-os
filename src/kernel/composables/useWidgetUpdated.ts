import { computed, type ComputedRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { relativeTimeLabel } from '../relativeTime'
import { useWidgetStatus } from './useWidgetStatus'
import { TICK_MINUTE, useWidgetTick } from './useWidgetTick'

/**
 * 「更新于 …」读数（(HIG) A-9，§4.3 的 `lastRefreshAt` 消费端）：只在取数型件里用。
 *
 * 件挂上宿主就已经排定了本次取数，所以「宿主让它取数的时刻」在首帧就存在——`lastRefreshAt`
 * 还没被 `markRefreshed()` 写过时按建上下文的时刻算：读数从第一帧就在，不留「先空后跳」的闪烁，
 * 预览沙箱与桌面因此同构（§9 T6 比的是骨架，不该依赖异步回报的先后）。
 * 分钟级心跳走共享调度器（A-10：不占取数预算），预览态不注册、`now` 固定在挂载那一刻。
 */
export function useWidgetUpdated(): ComputedRef<string> {
  const status = useWidgetStatus()
  const { t, locale } = useI18n()
  const now = useWidgetTick(TICK_MINUTE)
  const startedAt = Date.now()

  return computed(() =>
    t('widgets.updated', {
      time: relativeTimeLabel(status.lastRefreshAt.value ?? startedAt, now.value, locale.value),
    }),
  )
}
