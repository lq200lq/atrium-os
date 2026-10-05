import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'WebOS 脚手架',
  description:
    '企业级 Vue 3 前端脚手架：应用接入契约、权限模型、组件纵深、数据层、主题国际化、文档站与可观测',
  // base 定为 /docs/：文档站产物由 `npm run docs:embed` 同步进 public/docs/，
  // 供「文档中心」应用同源 iframe 嵌入（决策 D2′）。dev/preview 也一并挂在 /docs/ 下。
  base: '/docs/',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/app-development' },
      { text: '组件', link: '/components/' },
      { text: 'Token', link: '/tokens' },
      { text: '架构', link: '/architecture' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: '指南',
          items: [
            { text: '应用开发指南', link: '/guide/app-development' },
            { text: '架构与规范', link: '/architecture' },
          ],
        },
      ],
      '/components/': [
        {
          text: '组件 API',
          items: [
            { text: '总览', link: '/components/' },
            { text: 'OsTable 表格', link: '/components/table' },
            { text: 'OsForm 表单', link: '/components/form' },
            { text: '布局与容器', link: '/components/layout' },
            { text: '展示与数据', link: '/components/display' },
            { text: '反馈与展示', link: '/components/feedback' },
            { text: '导航组件', link: '/components/nav' },
            { text: '作用域配置', link: '/components/config' },
          ],
        },
      ],
    },
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一页', next: '下一页' },
    lastUpdated: { text: '最后更新' },
  },
})
