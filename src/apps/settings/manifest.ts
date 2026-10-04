import type { AppManifest } from '@/kernel/stores/appRegistry'

export const manifest: AppManifest = {
  id: 'settings',
  name: '设置',
  icon: 'settings',
  tint: 'from-slate-500 to-slate-700',
  entry: () => import('./App.vue'),
  window: { w: 620, h: 520, minW: 480, minH: 400 },
  singleton: true,
  dock: true,
  keywords: ['设置', '权限', '角色', 'settings', '偏好'],
  version: '0.1.0',
  category: 'settings',
  order: 90,
}
