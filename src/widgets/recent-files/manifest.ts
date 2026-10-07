import type { WidgetDrillContext, WidgetManifest } from '@/kernel/stores/widgetRegistry'

/**
 * 下钻落点：件把「最近一条」或用户点过的那条文件路径写进 selected（string），
 * 这里解出来传给文件管理；读不到兜底落「我的文件」。
 * key 与 path 同值：文件管理非 singleton，无 key 会在 windowManager 里叠出一排同路径窗口。
 */
function payloadFor(ctx: WidgetDrillContext): { path: string; key: string } {
  const path = (ctx.selected as string | undefined) ?? '/我的文件'
  return { path, key: `path:${path}` }
}

export const manifest: WidgetManifest = {
  id: 'recent-files',
  name: '最近文件',
  nameKey: 'widgets.names.recent-files',
  descriptionKey: 'widgets.descriptions.recent-files',
  icon: 'file-text',
  tint: 'from-indigo-700 to-blue-800',
  entry: () => import('./App.vue'),
  widget: { sizes: ['md', 'lg'], defaultSize: 'md' },
  keywords: ['最近', '文件', '历史', '编辑记录', 'recent', 'files', 'history', 'documents'],
  version: '1.0.0',
  order: 40,
  refresh: 'minute',
  config: [
    {
      key: 'count',
      type: 'number',
      labelKey: 'widgets.config.count',
      default: 8,
      min: 4,
      max: 8,
      step: 2,
    },
  ],
  openAppId: { appId: 'file-manager', payloadFor },
  // 鉴权与落点同源：件身就是文件管理里的文件名，拿不到 app:file-manager 的角色不该看见它
  // （这也是目录灰态行「需要 <角色>」的唯一内置实例，§4.8 H-10）
  permissions: ['app:file-manager'],
}
