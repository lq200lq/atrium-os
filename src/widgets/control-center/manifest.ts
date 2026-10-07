import type { WidgetManifest } from '@/kernel/stores/widgetRegistry'

export const manifest: WidgetManifest = {
  id: 'control-center',
  name: '快捷设置',
  nameKey: 'widgets.names.control-center',
  descriptionKey: 'widgets.descriptions.control-center',
  icon: 'layout-grid',
  tint: 'from-slate-600 to-slate-800',
  entry: () => import('./App.vue'),
  widget: { sizes: ['md', 'lg'], defaultSize: 'md' },
  keywords: [
    '快捷设置',
    '控制中心',
    '主题',
    '强调色',
    '壁纸',
    '语言',
    'controls',
    'settings',
    'theme',
    'accent',
    'wallpaper',
    'language',
  ],
  version: '1.0.0',
  order: 20,
  // 下钻落点：设置应用的「外观」一节（§4.5 H-1，payload 由 settings/App.vue 消费）
  openAppId: {
    appId: 'settings',
    payloadFor: () => ({ section: 'appearance' }),
  },
}
