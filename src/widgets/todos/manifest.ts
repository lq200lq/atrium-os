import type { WidgetManifest } from '@/kernel/stores/widgetRegistry'
import { TASKS_KEY, toIsoDay } from '@/kernel/widget/taskSchedule'

export const manifest: WidgetManifest = {
  id: 'todos',
  name: '今日待办',
  nameKey: 'widgets.names.todos',
  descriptionKey: 'widgets.descriptions.todos',
  description: '跟踪今天要完成的事项',
  icon: 'notebook-pen',
  tint: 'from-emerald-700 to-teal-800',
  entry: () => import('./App.vue'),
  widget: { sizes: ['md', 'lg'], defaultSize: 'md' },
  padding: 'compact',
  // 变化来源是用户勾选与「今日」应用的写入，不需要宿主定时拉
  refresh: 'manual',
  keywords: ['todo', 'task', 'checklist', '待办', '任务', '清单', '今日'],
  data: { key: TASKS_KEY, scope: 'shared' },
  config: [
    {
      key: 'showCompleted',
      type: 'boolean',
      labelKey: 'widgets.config.showCompleted',
      default: false,
    },
    {
      key: 'limit',
      type: 'number',
      labelKey: 'widgets.config.limit',
      default: 5,
      min: 3,
      max: 8,
      step: 1,
    },
    {
      key: 'scope',
      type: 'select',
      labelKey: 'widgets.config.scope',
      default: 'today',
      options: [
        { value: 'today', labelKey: 'widgets.configOptions.scope.today' },
        { value: 'week', labelKey: 'widgets.configOptions.scope.week' },
        { value: 'all', labelKey: 'widgets.configOptions.scope.all' },
      ],
    },
  ],
  // 勾选与就地添加都在卡内（§4.5 交互型）；下钻走标题行，落到「今日」应用的未完成筛选
  interactive: true,
  openAppId: {
    appId: 'today',
    payloadFor: (ctx) => ({
      date: ctx.selected ?? toIsoDay(new Date()),
      scope: ctx.config.scope ?? 'today',
      showCompleted: ctx.config.showCompleted === true,
    }),
  },
  seed: true,
  version: '1.0.0',
  order: 30,
}
