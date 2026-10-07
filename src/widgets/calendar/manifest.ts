import type { WidgetManifest } from '@/kernel/stores/widgetRegistry'
import { EVENTS_KEY, toIsoDay } from '@/kernel/widget/taskSchedule'

export const manifest: WidgetManifest = {
  id: 'calendar',
  name: '月历',
  nameKey: 'widgets.names.calendar',
  descriptionKey: 'widgets.descriptions.calendar',
  description: '浏览本月日期，并跟进今天的日程',
  icon: 'calendar',
  tint: 'from-sky-700 to-indigo-800',
  entry: () => import('./App.vue'),
  widget: { sizes: ['md', 'lg'], defaultSize: 'md' },
  padding: 'compact',
  // 日期推进是天级的，但跨零点要让件重算：件内用半小时心跳兜住
  refresh: 'day',
  keywords: ['calendar', 'month', 'date', 'schedule', '日历', '月历', '日程', '日期'],
  data: { key: EVENTS_KEY, scope: 'shared' },
  config: [
    {
      key: 'weekStart',
      type: 'select',
      labelKey: 'widgets.config.weekStart',
      default: 'auto',
      options: [
        { value: 'monday', labelKey: 'widgets.configOptions.weekStart.monday' },
        { value: 'sunday', labelKey: 'widgets.configOptions.weekStart.sunday' },
        { value: 'auto', labelKey: 'widgets.configOptions.weekStart.auto' },
      ],
    },
    { key: 'showAgenda', type: 'boolean', labelKey: 'widgets.config.showAgenda', default: true },
  ],
  // 卡内要点选日期，平台不接管整块点击（§4.5 交互型）；下钻走标题行与卡片菜单
  interactive: true,
  openAppId: {
    appId: 'today',
    // 没点选过日期就落「今天」；用 toIsoDay 而不是 toISOString，UTC 换日会把落点偏移一天
    payloadFor: (ctx) => ({ date: ctx.selected ?? toIsoDay(new Date()) }),
  },
  seed: true,
  version: '1.0.0',
  order: 20,
}
