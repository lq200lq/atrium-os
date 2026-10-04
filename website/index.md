---
layout: home
hero:
  name: WebOS 脚手架
  text: 企业级 Vue 3 前端脚手架
  tagline: 万物皆应用 —— 应用接入契约 / 权限模型 / 组件纵深 / 数据层 / 主题国际化 / 文档站与可观测
  actions:
    - theme: brand
      text: 应用开发指南
      link: /guide/app-development
    - theme: alt
      text: 组件 API
      link: /components/
features:
  - title: 应用接入契约
    details: AppManifest 类型安全契约 + import.meta.glob 自动注册 + gen:app 生成器，新增应用零改壳层。
  - title: 权限模型
    details: 权限点为主、角色为集合，canAccessApp 单一判定收口所有派生入口，wm.open 未授权留痕通知中心。
  - title: 组件纵深
    details: 18 个 src/ui 组件覆盖表格/表单/反馈/录入/展示，component-gallery 可视化验收。
  - title: 数据访问层
    details: Query/Page/DataSource 契约 + applyQuery 纯函数，fixture/vfs 两实现共用契约单测，三态规范内建。
  - title: 主题与国际化
    details: token 两层（语义 + 原始值），暗色/强调色切换零工具类改动；vue-i18n 双语，未翻译回退中文。
  - title: 可观测
    details: 全局错误边界 + 错误日志环形缓冲落 IndexedDB，settings 内可回看，应用崩溃不拖垮壳层。
---
