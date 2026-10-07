import type { WidgetManifest } from '@/kernel/stores/widgetRegistry'
import { ZONE_VALUES } from './zones'

/** 候选只给「值 + labelKey」：19 个城市的可读名留在语言包里（§4.11，E6） */
const TZ_OPTIONS = ZONE_VALUES.map((value) => ({
  value,
  labelKey: `widgets.configOptions.tz.${value}`,
}))

// 下钻豁免：内容即答案——「现在几点」在卡上就是终点，没有详情应用可指（§4.9 批次 A 唯一免下钻件）
export const manifest: WidgetManifest = {
  id: 'clock',
  name: '时钟',
  nameKey: 'widgets.names.clock',
  descriptionKey: 'widgets.descriptions.clock',
  description: '查看现在的时间和日期',
  icon: 'clock',
  tint: 'from-indigo-600 to-sky-700',
  entry: () => import('./App.vue'),
  widget: { sizes: ['sm', 'md', 'lg'], defaultSize: 'md' },
  // sm 只有 160px 见方，16px 外边距要吃掉 20% 面积（H-7，决策 8）
  padding: 'compact',
  refresh: 'live',
  keywords: ['clock', 'time', 'watch', '时间', '时钟', '手表', '时区'],
  config: [
    { key: 'hour12', type: 'boolean', labelKey: 'widgets.config.hour12', default: false },
    { key: 'seconds', type: 'boolean', labelKey: 'widgets.config.seconds', default: true },
    {
      key: 'secondTz',
      type: 'select',
      labelKey: 'widgets.config.secondTz',
      default: 'local',
      options: TZ_OPTIONS,
    },
  ],
  // 19 个候选 + 需要搜索：schema 四类控件表达不了，按 §4.12 判据自绘面板
  configEntry: () => import('./Config.vue'),
  seed: true,
  version: '1.0.0',
  order: 10,
}
