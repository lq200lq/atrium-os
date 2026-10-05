# 应用开发指南

WebOS 是一个「万物皆应用」的前端脚手架。每个应用是一个自包含目录 `src/apps/<id>/`，通过 `AppManifest` 契约接入，由 `import.meta.glob` 自动注册——**新增/删除应用无需修改壳层代码**。

## 目录结构

```text
src/apps/<id>/
├── manifest.ts   # 接入契约（必需）
├── App.vue       # 应用根组件（异步入口；声明 embed 的外部网页应用不需要）
└── ...           # 应用自有子组件/资源
```

## 快速开始

用生成器 scaffolding 一个新应用：

```bash
npm run gen:app
```

按提示输入应用 id、名称、图标，生成器会创建 `manifest.ts` 与 `App.vue` 骨架并自动被 glob 收集。

## AppManifest 契约

```ts
// 公共字段（应用身份、外观、窗口、权限、排序）
interface AppBase {
  id: string // 全局唯一，与目录名一致
  name: string // 默认名（中文），窗口标题回退用
  icon: IconName // 图标名，见 kernel/icons.ts 的 ICON_MAP
  tint?: string // Dock 磁贴装饰渐变（可选）
  window: { w: number; h: number; minW?: number; minH?: number }
  singleton?: boolean // 是否单例（重复打开聚焦已有窗口）
  dock?: boolean // 是否默认固定到 Dock（缺省 true）
  keywords?: string[] // Spotlight 搜索关键字
  version?: string // 语义化版本，文档站/CHANGELOG 消费
  category?: AppCategory // 'system'|'productivity'|'data'|'settings'|'other'
  permissions?: string[] // 访问所需权限点；为空即公开
  nameKey?: string // i18n 文案 key，回退到 name
  order?: number // 排序权重，越小越靠前（缺省 100）
}

// 内容来源二选一，类型层互斥：都不给或都给都编译不过
export type AppManifest = AppBase &
  (
    | { entry: () => Promise<Component>; embed?: never } // DOM 应用：() => import('./App.vue')
    | { embed: { url: string }; entry?: never } // 外部网页应用：内核 EmbedView 渲染
  )
```

### 关键字段说明

- **entry**：必须是动态 `import()`，保证每个应用构建为独立异步 chunk，首屏不加载未打开的应用。
- **embed**：外部站点地址。声明它就不需要 `entry`/`App.vue`，`register()` 会合成内置 `EmbedView`（见下节「外部网页应用」）。
- **permissions**：权限点数组（如 `['app:file-manager']`）。鉴权唯一判定是 `session.canAccessApp(manifest)`，`accessibleApps`/`dockApps`/Spotlight/应用中心均由它派生；`wm.open` 是单一 gate，未授权返回 `null` 并在通知中心留痕。
- **nameKey**：i18n key（如 `apps.fileManager`）。`useAppName()` 统一解析：有 `nameKey` 走翻译，否则回退 `name`。应用「内容」文案是否本地化由各应用自行决定，壳层只负责名称。
- **order**：Dock/应用中心/Spotlight 的排序依据，稳定插入不依赖 glob 顺序。

## 外部网页应用（embed 类目）

把一个网站挂成应用：manifest 只声明地址，不写组件。

```ts
export const manifest: AppManifest = {
  id: 'docs-center',
  name: '文档中心',
  icon: 'book-open',
  embed: { url: '/docs/' }, // 同源文档站；用户自己添加的应用指向外部站点
  window: { w: 900, h: 640, minW: 520, minH: 360 },
  singleton: true,
  order: 45,
}
```

- **渲染仍是一条路径**：`register()` 见到 `embed` 就合成 `src/windows/EmbedView.vue`，`WindowFrame`/`windowManager`/壳层不为类目加分支——这是架构决策 **D2′**（原「纯 DOM，不用 iframe」收窄而来：壳层材质、窗口动画、错误边界、i18n 永远走 DOM，iframe 只允许出现在外部网页应用的内容区）。
- **用户可在运行期添加**：应用中心 →「网页应用」分区，填名称与地址即可；记录落 IndexedDB（`webapps-v1`），启动时在第一波 restore 内注册进注册表（必须早于窗口布局恢复，否则这些 appId 会被当成未知应用丢弃）。
- **地址在写入边界校验**：`kernel/webapp/url.ts` 用**正向协议白名单**只放 `http:`/`https:`（`new URL('javascript:alert(1)')` 是能解析成功的，反向黑名单必漏），剥凭证、限长 2048。
- **沙箱取值是有意的**：给 `allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-presentation`，**不给 `allow-top-navigation`**——外部页面不能把整个系统顶掉。`allow-scripts`+`allow-same-origin` 只对同源文档构成逃逸，而外部地址按构造是第三方。
- **跨源读不到，不假装能读**：窗口标题恒为 `manifest.name`，没有前进/后退/URL 回读，暗色主题不注入 frame。被 `X-Frame-Options`/CSP `frame-ancestors` 拒绝时浏览器加载的是 `about:blank` 且照常触发 `load`，**无法可靠检测**，所以 `EmbedView` 只做「超时 → 警示态 + 重试 + 新标签页打开」并明示限制，不谎称识别出了拒绝。
- **不要在应用里自写 iframe**，也不要与 frame 内容建 `postMessage` 通道（本阶段没有这个协议）。

## 应用内可用的能力

- **窗口上下文**：`useWindowContext()` 拿到当前窗口 id；拖拽/缩放由 `WindowFrame` 统一处理，应用无需关心。
- **数据访问**：消费 `kernel/data` 的 `DataSource` 契约（fixture / vfs 两实现），分页/排序/筛选用 `applyQuery` 纯函数，变更失败 reject 供乐观回滚。
- **通知**：`useNotification().push(title, body, action?)`，`action` 可带跳转 appId 作为可操作出口。
- **错误**：应用渲染期抛错由 `WindowFrame` 内的 `ErrorBoundary` 就地捕获——显示错误态 + 重新加载按钮，落错误日志，**不拖垮壳层**。可在 settings「诊断日志」回看。
- **UI 组件**：统一使用 `src/ui` 的 `Os*` 组件，勿在业务代码里复制样式（开闭原则，相似能力收敛到基础组件参数化）。

## 主题与样式约束

- 颜色一律走语义 token（`bg-surface`/`text-ink`/`border-line`/`bg-accent-soft`…），**禁止散落硬编码色值**（lint + grep 双查）。暗色切换只换 token 原始值，应用零改动。
- 装饰性渐变（如应用磁贴 tint）是例外，但也应收敛在 manifest 或组件参数里，不在业务模板中散落。

## 测试要求

- 新逻辑 → 单元测试（Vitest + @vue/test-utils）。
- 新流程 → E2E（Playwright，`tests/e2e/smoke.spec.ts`）。
- 提交经 husky 门禁：lint-staged（ESLint + Prettier）+ type-check。
