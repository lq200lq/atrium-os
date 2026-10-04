import type { AppManifest } from '@/kernel/stores/appRegistry'

export const manifest: AppManifest = {
  id: 'doc-editor',
  name: '文档编辑',
  icon: 'notebook-pen',
  tint: 'from-blue-500 to-indigo-600',
  entry: () => import('./App.vue'),
  window: { w: 720, h: 520, minW: 480, minH: 360 },
  singleton: false,
  dock: true,
  keywords: ['文档', '编辑', 'doc'],
}
