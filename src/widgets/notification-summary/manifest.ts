import type { WidgetManifest } from '@/kernel/stores/widgetRegistry'

/**
 * 批次 C「通知摘要」（§4.9）：未读数 + 最近 3 条标题，数据源是 `notification` store（只读，不写）。
 * 无配置项（H-9：默认即呈现）；`refresh: 'minute'` 供宿主「立即刷新」与 updated 时钟。
 */
// 下钻豁免：通知中心是壳层面板而非应用，没有 appId 可声明；件内标题行/数字各自是入口（§4.5 交互型）
export const manifest: WidgetManifest = {
  id: 'notification-summary',
  name: '通知摘要',
  nameKey: 'widgets.names.notification-summary',
  descriptionKey: 'widgets.descriptions.notification-summary',
  icon: 'bell',
  tint: 'from-amber-700 to-orange-800',
  entry: () => import('./App.vue'),
  widget: { sizes: ['sm', 'md'], defaultSize: 'sm' },
  refresh: 'minute',
  version: '0.1.0',
  order: 70,
  keywords: ['通知', '未读', '消息', 'notification', 'unread'],
}
