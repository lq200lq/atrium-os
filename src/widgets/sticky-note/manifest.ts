import type { WidgetManifest } from '@/kernel/stores/widgetRegistry'

export const manifest: WidgetManifest = {
  id: 'sticky-note',
  name: '便签',
  nameKey: 'widgets.names.sticky-note',
  descriptionKey: 'widgets.descriptions.sticky-note',
  icon: 'notebook-pen',
  tint: 'from-amber-700 to-orange-800',
  entry: () => import('./App.vue'),
  widget: { sizes: ['sm', 'md', 'lg'], defaultSize: 'md' },
  keywords: ['便签', '备忘', '笔记', '贴条', 'sticky', 'note', 'memo', 'scratch'],
  version: '1.0.0',
  order: 60,
  data: { key: 'sticky-note', scope: 'instance' },
  // 下钻豁免（§4.9 准入第 3 条）：lg 就地编辑，卡内即终点
}
