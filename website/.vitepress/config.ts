import { defineConfig } from 'vitepress'

// Token 与架构同属「参考」区：这两页此前没有 sidebar，进场即是空栏，彼此也跳不过去
const referenceSidebar = [
  {
    text: '参考',
    items: [
      { text: '设计 Token', link: '/tokens' },
      { text: '架构与规范', link: '/architecture' },
    ],
  },
]

export default defineConfig({
  lang: 'zh-CN',
  title: 'Atrium OS',
  description:
    '企业级 Vue 3 前端脚手架：应用接入契约、权限模型、组件纵深、数据层、主题国际化、文档站与可观测',
  // base 定为 /docs/：文档站产物由 `npm run docs:embed` 同步进 public/docs/，
  // 供「文档中心」应用同源 iframe 嵌入（决策 D2′）。dev/preview 也一并挂在 /docs/ 下。
  base: '/docs/',
  cleanUrls: true,
  // 页脚的「最后更新」要有真时间戳必须开根级开关：只配 themeConfig.lastUpdated 是改文案不是启功能
  lastUpdated: true,
  themeConfig: {
    // 文档中心是「查文档」的入口，搜索不能缺；热键归属见 guide/app-development 的 embed 一节。
    // 中文站不能只开 provider：默认件的面板文案是英文，translations 补齐才算做完。
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
          modal: {
            displayDetails: '展开详情列表',
            resetButtonTitle: '清除查询条件',
            backButtonTitle: '关闭搜索',
            noResultsText: '没有找到相关结果',
            footer: {
              selectText: '选择',
              selectKeyAriaLabel: '回车',
              navigateText: '切换',
              navigateUpKeyAriaLabel: '上箭头',
              navigateDownKeyAriaLabel: '下箭头',
              closeText: '关闭',
              closeKeyAriaLabel: 'esc',
            },
          },
        },
      },
    },
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
            { text: '小组件开发指南', link: '/guide/widget-development' },
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
      '/tokens': referenceSidebar,
      '/architecture': referenceSidebar,
    },
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一页', next: '下一页' },
    // 只有根级 lastUpdated: true 打开之后，这段文案才有宿主；否则它是一段永不显示的死配置
    lastUpdated: { text: '最后更新' },
  },
})
