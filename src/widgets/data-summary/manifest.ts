import type { WidgetManifest } from '@/kernel/stores/widgetRegistry'

/**
 * 批次 C「数据摘要」（§4.9）：数据看板 fixture 的关键指标 + 迷你趋势，只读展示型。
 * 无配置项；`refresh: 'hour'`。下钻＝`data-board` 对应图表（payload 见下方 `payloadFor`）。
 */
export const manifest: WidgetManifest = {
  id: 'data-summary',
  name: '数据摘要',
  nameKey: 'widgets.names.data-summary',
  descriptionKey: 'widgets.descriptions.data-summary',
  icon: 'activity',
  tint: 'from-emerald-700 to-green-800',
  entry: () => import('./App.vue'),
  widget: { sizes: ['md'], defaultSize: 'md' },
  refresh: 'hour',
  openAppId: {
    // 展示型：整块可点，带 payload 落到「按部门人数」这一具体图表（§4.5 第 3 项 / H-1）
    appId: 'data-board',
    payloadFor: () => ({ chart: 'headcount-by-dept' }),
  },
  version: '0.1.0',
  order: 80,
  keywords: ['数据', '指标', '趋势', '看板', 'data', 'metrics'],
}
