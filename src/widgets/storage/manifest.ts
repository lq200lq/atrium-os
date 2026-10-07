import type { WidgetDrillContext, WidgetManifest } from '@/kernel/stores/widgetRegistry'

/**
 * 下钻落点：件在挂载期把「最大分类」写进 selected（{ path }），这里解出来传给文件管理；
 * 读不到 selected（首帧 / 预览）兜底落「我的文件」。
 * key 与 path 同值：文件管理非 singleton，无 key 会在 windowManager 里叠出一排同路径窗口。
 */
function payloadFor(ctx: WidgetDrillContext): { path: string; key: string } {
  const selected = ctx.selected as { path?: string } | undefined
  const path = selected?.path ?? '/我的文件'
  return { path, key: `path:${path}` }
}

export const manifest: WidgetManifest = {
  id: 'storage',
  name: '存储用量',
  nameKey: 'widgets.names.storage',
  descriptionKey: 'widgets.descriptions.storage',
  icon: 'boxes',
  tint: 'from-cyan-700 to-sky-800',
  entry: () => import('./App.vue'),
  widget: { sizes: ['sm', 'md'], defaultSize: 'sm' },
  keywords: [
    '存储',
    '用量',
    '空间',
    '配额',
    '回收站',
    'storage',
    'quota',
    'disk',
    'space',
    'trash',
  ],
  version: '1.0.0',
  order: 30,
  refresh: 'hour',
  config: [
    {
      key: 'unit',
      type: 'select',
      labelKey: 'widgets.config.unit',
      default: 'percent',
      options: [
        { value: 'bytes', labelKey: 'widgets.configOptions.unit.bytes' },
        { value: 'percent', labelKey: 'widgets.configOptions.unit.percent' },
      ],
    },
  ],
  openAppId: { appId: 'file-manager', payloadFor },
}
