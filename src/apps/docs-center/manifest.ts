import type { AppManifest } from '@/kernel/stores/appRegistry'

/**
 * embed 类目的官方样板（决策 D2′）：没有 entry，只有 embed——渲染组件由 appRegistry 合成。
 *
 * 地址必须带扩展名：Vite 的 SPA fallback 会把 `/docs/` 这类无扩展名路径回退到 **WebOS 自己的**
 * index.html，同源相对入口因此在 shell 里自套壳。构建产物里 `/docs/index.html` 是真文件，命中前。
 * main.ts 的反嵌套守卫是这条约束的第二道保险，不是替代它。
 */
export const manifest: AppManifest = {
  id: 'docs-center',
  name: '文档中心',
  nameKey: 'apps.docsCenter',
  icon: 'book-open',
  embed: { url: '/docs/index.html' },
  window: { w: 900, h: 640, minW: 520, minH: 360 },
  singleton: true,
  dock: true,
  keywords: ['文档', '指南', 'docs', '手册'],
  version: '0.1.0',
  category: 'system',
  // 排在系统类应用之前、设置（90）之后靠前位置，避免把常用工作类应用挤到后面
  order: 45,
}
