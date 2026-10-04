import type { AppManifest } from '@/kernel/stores/appRegistry'

export const manifest: AppManifest = {
  id: 'component-gallery',
  name: '组件陈列',
  icon: 'boxes',
  tint: 'from-fuchsia-500 to-pink-600',
  entry: () => import('./App.vue'),
  window: { w: 760, h: 560, minW: 560, minH: 420 },
  singleton: true,
  dock: true,
  keywords: ['组件', '陈列', 'gallery', 'ui', '示例'],
  version: '0.1.0',
  category: 'system',
  order: 80,
}
