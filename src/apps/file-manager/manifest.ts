import type { AppManifest } from '@/kernel/stores/appRegistry'

export const manifest: AppManifest = {
  id: 'file-manager',
  name: '文件管理',
  icon: 'folder',
  tint: 'from-sky-500 to-blue-600',
  entry: () => import('./App.vue'),
  window: { w: 680, h: 460, minW: 480, minH: 320 },
  singleton: false,
  dock: true,
  keywords: ['文件', '目录', 'folder'],
}
