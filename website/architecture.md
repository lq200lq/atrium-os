# 架构与规范

本页是 `docs/` 下设计文档的导读镜像（设计文档为本地工作区、不入库，本页保留各文档的要点索引）：

- `AtriumOS前端架构设计.md` —— 分层架构、壳层/内核/应用边界
- `AtriumOS小组件功能设计.md` / `AtriumOS小组件开发指南.md` —— 桌面小组件的功能设计与接入契约（与本站[小组件开发指南](/guide/widget-development)同源）
- `AtriumOS设计规范与工程基建.md` —— token 体系、组件规范、工程门禁
- `AtriumOS脚手架迭代路线.md` —— S1–S6 阶段划分与实施状态回写
- `AtriumOS应用开发指南.md` —— 应用接入契约（与本站[指南](/guide/app-development)同源）
- `AtriumOS对标AntDesign迭代规划.md` —— S7~S14 规划与状态台账

## 分层架构

<script setup>
const layers = [
  {
    name: 'shell',
    title: '壳层',
    items: ['TopBar', 'Desktop', 'Dock', 'Spotlight', 'WidgetLayer（桌面小组件）', 'NotificationCenter'],
  },
  {
    name: 'windows',
    title: '窗口层',
    items: ['WindowFrame', 'ErrorBoundary', 'EmbedView（外部网页应用内容区）'],
  },
  {
    name: 'apps',
    title: '应用层',
    items: ['src/apps/<id> 自包含', 'AppManifest 契约接入', 'glob 自动注册'],
  },
  {
    name: 'kernel',
    title: '内核',
    items: ['stores', 'data', 'fs', 'bus', 'observability', 'icons', 'layout', 'webapp', 'widget'],
  },
  { name: 'ui', title: '基础组件', items: ['41 个 Os* 组件', '消费语义 token'] },
]
</script>

<LayerDiagram :layers="layers" />

## 内核模块

| 模块                     | 职责                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `stores/appRegistry`     | 应用注册表，`accessibleApps`/`dockApps`/`byId` 派生                                                                        |
| `stores/session`         | 权限模型（权限点为主、角色为集合），`canAccess` 单一判定（应用与小组件共用）                                               |
| `stores/windowManager`   | 窗口生命周期、焦点、层叠、布局持久化，`open` 为鉴权单一 gate                                                               |
| `stores/webApps`         | 用户添加的外部网页应用（`webapps-v1` 持久化），派生 `embed` 类目 manifest 注册                                             |
| `stores/widgetRegistry`  | 桌面小组件种类注册表（`src/widgets/<id>/manifest.ts` glob 收集）                                                           |
| `stores/widgets`         | 小组件实例与尺寸/摆放/配置（`widgets-v1` 持久化），增删不进窗口体系                                                        |
| `widget/geometry`        | 小组件整数网格纯函数：`CELL/GUTTER/MARGIN/BAND_COLS`、`placeWidgets`（占用网格：流式 + 手动同一求解）、`pxToCell`/`sizePx` |
| `widget/scheduler`       | 全局共享计时器 `subscribeTick` + `REFRESH_PERIOD`（live/minute/hour/day/manual），`visibilitychange` 暂停与回前台补扫      |
| `widget/material`        | 卡片材质唯一类串 `WIDGET_CARD_CLASS` + 内边距档 `widgetPaddingClass`（桌面与预览沙箱共用）                                 |
| `widget/taskSchedule`    | 「今日待办/日程」数据契约（VFS `/我的数据` 的 tasks/events），待办件与「今日」应用共读、互不 import                        |
| `webapp/url`             | 外部地址校验归一：正向协议白名单 `http:`/`https:`、剥凭证、限长（用户输入边界）                                            |
| `stores/settings`        | 用户偏好（Dock 固定项、语言），持久化                                                                                      |
| `stores/theme`           | 主题（壁纸/明暗/强调色），版本迁移                                                                                         |
| `stores/vfs`             | 虚拟文件系统，IndexedDB 持久化                                                                                             |
| `stores/notification`    | 通知中心，订阅 `vfs:changed` 等总线事件                                                                                    |
| `data/`                  | 数据访问契约（Query/Page/DataSource + `applyQuery` 纯函数），fixture/vfs 两实现                                            |
| `observability/errorLog` | 错误日志环形缓冲，落 IndexedDB，settings 内回看                                                                            |
| `bus/commandBus`         | 轻量事件总线                                                                                                               |
| `fs/idb`                 | IndexedDB kv 封装（`idbGet`/`idbSet`）                                                                                     |

## 关键设计原则

- **单一判定收口**：权限判定只在 `session.canAccess`，开窗 gate 只在 `wm.open`，避免多处过滤漂移；小组件实例的渲染入口同样经它派生。
- **小组件是桌面件**：`WidgetRegistry` + `Widgets` 两个 store + `WidgetLayer/WidgetFrame`（`z-desktop`，在窗口之下），不进窗口体系、不进 Dock；卡片材质收敛在 `kernel/widget/material.ts` 一处（桌面与预览沙箱共用）。摆放与尺寸是「连续手势 + 离散吸附」：拖拽吸到整数格、换档只取已声明档（入口是卡片右键菜单的档位组与 `⌥←/⌥→`，卡片表面不放拖角手柄，2026-10-07 起，见功能设计 §8 偏差 29），不引入像素级自由态（架构 D15）；件内自有数据落 VFS `/我的数据`（D12）、表面走主题同源 token 层（D13）、内容有 HIG 参照的纪律（D14）。详见[小组件开发指南](/guide/widget-development)与 `docs/AtriumOS小组件功能设计.md`。
- **契约优先**：数据访问、应用接入都走类型安全契约，多实现共用同一套契约单测（`runContract`）。
- **纯前端**：无后端/mock server，「真数据」= VFS store CRUD + IndexedDB。
- **失败可查**：错误不只 `console.warn`，落库并在界面回看；数据层错误 reject 供乐观回滚，不吞异常、不同步抛。
- **token 硬约束**：颜色只走语义 token，暗色切换零组件改动。
- **开闭原则**：相似能力收敛到基础组件参数化，业务代码不复制样式。
- **内容区单一渲染路径（D2′）**：窗口内容一律经 `registry` 合成的组件渲染——DOM 应用给 `entry`，外部网页应用给 `embed` 由内置 `EmbedView` 承载 iframe。壳层材质、窗口动画、错误边界、i18n 只覆盖 DOM 侧；iframe 是唯一例外且只出现在那一处，`WindowFrame` 不为类目加分支。

## 可观测

- `app.config.errorHandler` + window `error`/`unhandledrejection` 监听 → 全局错误落日志。
- `WindowFrame` 内 `ErrorBoundary`（`onErrorCaptured` 返回 `false`）就地捕获应用渲染错误 → 窗口显示错误态 + 重新加载，**不拖垮壳层**，不重复触发全局 handler。
- 错误日志环形缓冲（最近 50 条）落 IndexedDB `errorlog-v1`，settings「诊断日志」可回看与清空。

## 工程门禁

- husky pre-commit：lint-staged（ESLint + Prettier）+ type-check（vue-tsc）。
- 测试：Vitest 单测（含覆盖率阈值）+ Playwright E2E。
- 构建：`manualChunks` 分 vendor/vue/apps；`scripts/check-bundle.mjs` 包体预算门禁。
- 版本：changesets 语义化版本 + CHANGELOG。
