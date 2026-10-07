import type { AppManifest } from '@/kernel/stores/appRegistry'

export const manifest: AppManifest = {
  id: 'widget-center',
  name: '小组件中心',
  nameKey: 'apps.widgetCenter',
  icon: 'puzzle',
  tint: 'from-teal-700 to-cyan-800',
  entry: () => import('./App.vue'),
  window: { w: 560, h: 520, minW: 420, minH: 380 },
  singleton: true,
  dock: true,
  keywords: ['小组件', '挂件', '桌面', 'widget'],
  version: '0.1.0',
  category: 'system',
  order: 50,
}
