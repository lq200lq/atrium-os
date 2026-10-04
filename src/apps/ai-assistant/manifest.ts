import type { AppManifest } from '@/kernel/stores/appRegistry'

export const manifest: AppManifest = {
  id: 'ai-assistant',
  name: 'AI 助手',
  nameKey: 'apps.aiAssistant',
  icon: 'bot',
  tint: 'from-violet-500 to-purple-600',
  entry: () => import('./App.vue'),
  window: { w: 420, h: 560, minW: 340, minH: 320 },
  singleton: true,
  dock: true,
  keywords: ['ai', '助手', '对话'],
  version: '0.1.0',
  category: 'productivity',
  order: 10,
  permissions: ['app:ai-assistant'],
}
