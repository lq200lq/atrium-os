import type { WidgetPadding } from '../stores/widgetRegistry'

/**
 * 卡片材质的唯一一份类串（§4.6 表面 token 层）：桌面卡片与 §4.8 的预览沙箱共用它——
 * 预览要与桌面同材质同几何，否则「预览里看着合适、上桌面就溢出」会重新变成 E17。
 * 它留在 kernel 而不是 `src/ui`：桌面件材质与管理面材质是两套（§7 明确不做）。
 */
export const WIDGET_CARD_CLASS =
  'cq-widget overflow-hidden rounded-dock border border-widget-border bg-widget-surface text-widget-ink shadow-dock backdrop-blur-xl'

/** 内边距档（H-7）：由宿主给，件侧不可声明 */
export function widgetPaddingClass(padding: WidgetPadding | undefined): string {
  return padding === 'compact' ? 'p-widget-compact' : 'p-widget'
}
