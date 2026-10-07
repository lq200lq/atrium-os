---
'atrium-os': minor
---

S14 小组件管理面与卡片菜单：把 S13 留的两个口子补齐——卡片右键不再「直开抽屉」，管理面升级为独立应用并把「查看 / 安装 / 启用 / 卸载」四个动作补全。

**卡片菜单**：`WidgetFrame` 的 `@contextmenu` 由 `ui.openWidgetGallery()` 改为推条目出去——尺寸档（多档才给，勾当前档）/ 打开应用（声明了 `openAppId` 才有）/ 管理小组件…（进小组件中心）/ 移除（danger）。菜单做成**壳层单例通道**（`shellUi.contextMenu` + `shell/ContextMenu.vue` 挂 App 根级）：小组件层自身是 `z-desktop` 的层叠上下文，弹层挂在层内会被窗口盖住；单例也让桌面菜单与卡片菜单不会叠在一起。`ContextMenu.vue` 从「读 props 的桌面专用菜单」改为「读 store 的数据驱动宿主」——条目带 `checked`/`danger`/`separatorBefore` 三个渲染能力，位置按实测宽高夹取（去掉原先写死的 184/132 两个魔法数），`Desktop.vue` 交出本地菜单态改为在调用处组装条目。

**管理面收敛与独立应用**：抽屉体抽到 `src/components/WidgetConsole.vue`（外壳无关的共享叶层，shell 与 apps 都能 import），`shell/WidgetGallery.vue` 收薄成 `OsDrawer` 包一层（宽 380→420）；新增 `src/apps/widget-center/`（`puzzle` 图标 + 深档 tint，window 560×520，singleton/dock），靠既有的 `import.meta.glob('./apps/*/manifest.ts')` 自动注册，自然进 Dock / 应用中心 / Spotlight——`main.ts` 未改一行。

**kind 生命周期**：`widgets` store 新增 `kinds`（IDB 第二键 `widget-kinds-v1`，缺省 `{ installed: true, enabled: true }`，因此既有桌面与首启种子零变化）。**卸载** = 连带摘掉该 kind 全部实例（同 `webApps.remove` 连带关窗口径）+ 记未安装，可逆；**安装** = 回到货架（实例不复活）；**停用** = 实例与配置都留着、桌面不渲染（停用 ≠ 删除，台账行标「已禁用」）。派生拆两层：`renderable`（注册 + 鉴权 + 未卸载）给列表类入口，`visible`（再叠已启用）给 `WidgetLayer`。两个键并行还原，`main.ts` 的调用点不变。

**过程中被门禁与浏览器实测拦下的两处（已修）**：① 菜单分隔线写 `role="presentation"` 会破坏 `<ul>` 的 list 语义，axe 报 `list × 1`（改用 `aria-hidden` 的普通 `<li>`）；② **真数据 bug**：`uninstall` 用 `Array.prototype.filter` 重建实例数组，元素成了响应式代理，IDB 的结构化克隆抛 `DataCloneError`，而 `persist` 的 catch 把它吞成一行 warn——界面看着正常（DOM 靠 kind 状态隐藏）、数据其实没落库，刷新即「复活」。修法在写边界（落库前 `snapshot()` 剥掉代理），并把单测的 IDB mock 由 JSON 往返换成 `structuredClone`，让「代理混进落库数据」按真库口径暴露。

**门禁实测**：单测 66 文件 / 549 例（本次新增 19 例：菜单宿主 6 + 卡片菜单 3 + kind 生命周期 7 + 管理台台账 3），E2E 107 条全绿（a11y 9 场景、视觉 13 张；Dock 多一个磁贴连带重生成 shell-light/shell-dark/spotlight/app-center/widget-gallery 五张并肉眼过，新增 `widget-center.png`），首屏 247.1KB（+3.6KB，预算 700KB），11 个应用异步 chunk，`WidgetGallery` 由 5.0KB 收薄到 0.9KB，42 张 API 表 `docs:check` 一致，token 审计 129 文件通过（棘轮基线 +1 文件）。浏览器实测（browser-use，结构/DOM/计算样式口径；截图能力不可用）覆盖：菜单条目与勾选态、点尺寸档卡片实测 344→160、管理项开出小组件中心、停用/卸载/安装与刷新持久、桌面空白处右键仍是原桌面菜单、右下角菜单夹取在视口内。

**明确不做（挂账）**：拖拽/自由摆放（S13 既有）、每实例粒度的启用、`OsButton` 的 `danger` 对比度缺陷（均见规划 §8）。
