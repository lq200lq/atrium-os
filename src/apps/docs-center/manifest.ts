import type { AppManifest } from '@/kernel/stores/appRegistry'

/**
 * embed 类目的官方样板（决策 D2′）：没有 entry，只有 embed——渲染组件由 appRegistry 合成。
 *
 * 同源入口有三层，各管一段，别把任何一层当硬约束：
 * 1. 写成带扩展名的真文件地址（本例 `/docs/index.html`）最稳——不经过重写直接命中静态文件；
 * 2. `/docs/`、`/docs/components/`、`/docs/tokens` 这类目录根或无扩展名深链，由 vite.config.ts 的
 *    serve-embedded-docs 中间件按「真文件存在才重写」接住，dev 与 preview 同一条规则；
 * 3. 前两层都没兜住的（页面真不存在）落 main.ts 的反嵌套守卫——它给的是可读的降级说明，不是内容。
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
