import type { AppManifest } from '@/kernel/stores/appRegistry'

export const manifest: AppManifest = {
  id: 'data-board',
  name: '数据看板',
  icon: 'file-spreadsheet',
  tint: 'from-emerald-500 to-teal-600',
  entry: () => import('./App.vue'),
  window: { w: 760, h: 540, minW: 560, minH: 420 },
  singleton: true,
  dock: true,
  keywords: ['数据', '看板', '表格', '分页', 'data', 'board'],
  version: '0.1.0',
  category: 'data',
  order: 70,
}
