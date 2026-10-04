import type { AppManifest } from '@/kernel/stores/appRegistry'

export const manifest: AppManifest = {
  id: 'app-center',
  name: '应用中心',
  icon: 'puzzle',
  tint: 'from-indigo-500 to-sky-500',
  entry: () => import('./App.vue'),
  window: { w: 560, h: 480, minW: 420, minH: 360 },
  singleton: true,
  dock: true,
  keywords: ['应用', '启动器', 'launcher'],
  version: '0.1.0',
  category: 'system',
  order: 40,
}
