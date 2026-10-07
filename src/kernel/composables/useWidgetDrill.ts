import { computed, type ComputedRef } from 'vue'
import { useOS } from './useOS'
import { useWidgetContext, type WidgetContext } from './useWidgetContext'
import { resolveOpenTarget, type WidgetDrillContext } from '../stores/widgetRegistry'

export interface WidgetDrill {
  /** null = 该件没有下钻目标，或目标应用对当前会话不可访问（§4.5 第 2 项） */
  target: ComputedRef<{ appId: string; payload?: unknown } | null>
  open(): void
}

/**
 * 下钻（HIG「在正确的位置打开 App」）：payload 由 manifest 的 `payloadFor(ctx)` 构造，
 * ctx 里带件当前选中的那条内容（月历的日期、待办的筛选），所以落地页就是卡片上那条内容。
 * 宿主（`WidgetFrame` 的整块点击与菜单项）与件自己（标题行入口）消费同一个解析结果，
 * 两处不会给出两种落点——因此解析只有这一处，宿主把建好的上下文传进来即可。
 */
export function createWidgetDrill(ctx: WidgetContext): WidgetDrill {
  const os = useOS()

  const target = computed(() => {
    const drillCtx: WidgetDrillContext = {
      size: ctx.size.value,
      config: ctx.config.value,
      selected: ctx.selected.value,
    }
    const resolved = resolveOpenTarget(ctx.manifest.value?.openAppId, drillCtx)
    if (!resolved || !os.can(resolved.appId)) return null
    return resolved
  })

  return {
    target,
    open() {
      const t = target.value
      if (t) os.open(t.appId, t.payload)
    },
  }
}

/** 件侧入口：直接取宿主给的上下文 */
export function useWidgetDrill(): WidgetDrill {
  return createWidgetDrill(useWidgetContext())
}
