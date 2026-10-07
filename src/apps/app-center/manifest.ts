import type { AppManifest } from '@/kernel/stores/appRegistry'

export const manifest: AppManifest = {
  id: 'app-center',
  name: '应用中心',
  nameKey: 'apps.appCenter',
  icon: 'layout-grid',
  tint: 'from-indigo-600 to-sky-700',
  entry: () => import('./App.vue'),
  window: { w: 560, h: 480, minW: 420, minH: 360 },
  singleton: true,
  dock: true,
  dockAnchor: true,
  keywords: ['应用', '启动器', 'launcher'],
  version: '0.1.0',
  category: 'system',
  order: 40,
}
