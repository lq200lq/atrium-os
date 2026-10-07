import type { AppManifest } from '@/kernel/stores/appRegistry'

/**
 * 「今日」＝任务清单 + 日程的最小应用（§4.9 依赖清单 1、决策 3）：
 * 它是 `/我的数据/tasks.json` 与 `/我的数据/events.json` 的「家」——
 * 待办件与月历件删掉后数据仍有归属，`openAppId` 的下钻（带 date/scope payload）在这里被真实消费。
 * 与 `src/widgets/todos` **互不 import**，只共享 `kernel/widget/taskSchedule.ts` 的数据契约与 VFS 文件。
 */
export const manifest: AppManifest = {
  id: 'today',
  name: '今日',
  nameKey: 'apps.today',
  icon: 'calendar',
  tint: 'from-amber-700 to-orange-800',
  entry: () => import('./App.vue'),
  window: { w: 720, h: 560, minW: 420, minH: 360 },
  singleton: true,
  dock: true,
  keywords: ['今日', '待办', '任务', '日程', 'today', 'todo', 'task', 'schedule'],
  version: '1.0.0',
  category: 'productivity',
  order: 60,
}
