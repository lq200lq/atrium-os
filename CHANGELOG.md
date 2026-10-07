# Changelog

本文件记录 Atrium OS 前端脚手架的显著变更。版本由 [changesets](.changeset/) 管理。

## 0.1.0

企业级前端脚手架 S1–S6 六条工作线全部落地。

### S1 应用接入契约与生成器

- `AppManifest` 契约扩展（`version`/`category`/`permissions`/`nameKey`/`order`），`import.meta.glob` 自动注册，`gen:app` 生成器与应用开发指南。

### S2 权限模型与 settings 应用

- `session` 权限模型（权限点为主、角色为集合），`canAccessApp` 单一判定收口 `accessibleApps`/`dockApps`/`wm.open`，未授权留痕通知中心；settings 应用承载用户/角色切换。

### S3 组件纵深：表格 / 表单 / 反馈

- 13 个 `src/ui` 组件（表格/表单/反馈/录入/展示），`WindowFrame` Suspense 骨架屏，component-gallery 可视化验收场，file-manager 改用 OsTable/OsForm。

### S4 数据访问层与三态规范

- `kernel/data`（Query/Page/DataSource 契约 + `applyQuery` 纯函数），fixture/vfs 两实现共用契约单测，OsTable 内建 error 三态 + 重试，data-board 参考页，乐观更新回滚。

### S5 主题纵深与国际化

- token 分层（语义层 `tokens.css` + 原始值 `theme-light/dark.css` + accent 预设），暗色/强调色切换零工具类改动，`theme-v1` 版本迁移；vue-i18n（zh-CN/en-US，`manifest.nameKey` 回退），壳层/`src/ui`/settings/component-gallery 全量接入；修复 `settings.persist` 直接写响应式 Proxy 触发 `DataCloneError` 致语言偏好丢失（改 `toRaw`）。

### S6 文档站、版本与可观测

- VitePress 文档站（应用开发指南 / 组件 API / token 清单 / 架构镜像），`docs:dev`/`docs:build`。
- changesets 语义化版本 + CHANGELOG。
- 构建 `manualChunks` 分 vendor/vue/apps 三类，应用经动态 import 各自成 chunk；`scripts/check-bundle.mjs` 包体预算门禁（`build:check`）。
- 可观测：`app.config.errorHandler` + window 级错误/未处理 Promise 监听 + `ErrorBoundary` 窗口错误边界（应用崩溃不拖垮壳层，窗口内错误态可重载）；错误日志环形缓冲（最近 50 条）落 IndexedDB，settings 应用内可回看与清空。
