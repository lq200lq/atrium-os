import type { WidgetManifest } from '@/kernel/stores/widgetRegistry'

export const manifest: WidgetManifest = {
  id: 'system',
  name: '系统状态',
  nameKey: 'widgets.names.system',
  descriptionKey: 'widgets.descriptions.system',
  icon: 'activity',
  tint: 'from-green-700 to-emerald-800',
  entry: () => import('./App.vue'),
  widget: { sizes: ['sm', 'md'], defaultSize: 'sm' },
  keywords: [
    '系统',
    '状态',
    '硬件',
    '处理器',
    '内存',
    '网络',
    '电池',
    'system',
    'hardware',
    'cpu',
    'memory',
    'network',
    'battery',
  ],
  version: '1.0.0',
  order: 50,
  refresh: 'minute',
  config: [
    {
      key: 'metric',
      type: 'select',
      labelKey: 'widgets.config.metric',
      default: 'overview',
      options: [
        { value: 'overview', labelKey: 'widgets.configOptions.metric.overview' },
        { value: 'memory', labelKey: 'widgets.configOptions.metric.memory' },
        { value: 'storage', labelKey: 'widgets.configOptions.metric.storage' },
        { value: 'network', labelKey: 'widgets.configOptions.metric.network' },
      ],
    },
  ],
  // 下钻豁免（§4.9 准入第 3 条）：状态即答案，没有对应的详情应用
}
