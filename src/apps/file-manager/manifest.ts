import type { AppManifest } from '@/kernel/stores/appRegistry'

export const manifest: AppManifest = {
  id: 'file-manager',
  name: '文件管理',
  nameKey: 'apps.fileManager',
  icon: 'folder',
  tint: 'from-sky-700 to-blue-800',
  entry: () => import('./App.vue'),
  window: { w: 680, h: 460, minW: 480, minH: 320 },
  singleton: false,
  dock: true,
  keywords: ['文件', '目录', 'folder'],
  version: '0.1.0',
  category: 'productivity',
  order: 20,
  permissions: ['app:file-manager'],
}
