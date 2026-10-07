---
'webos': minor
---

S13 桌面小组件体系：把桌面上的小组件从「壳层里手写的三张卡片」升级为可扩展模块——开发者按「只动一个目录」（`src/widgets/<id>/`）的约定写自己的小组件，用户有增删/换尺寸/配置的闭环。

新增内核：`WidgetManifest` 契约与 `widgetRegistry`（`src/kernel/stores/widgetRegistry.ts`，与应用注册表同构：幂等、按 `order` 稳定插入、`markRaw(defineAsyncComponent)`，但**刻意不进窗口体系**——无 window/dock/category，改有 `widget.sizes`/`config`/`openAppId`/`seed`）；`widgets` 实例 store（IDB `widgets-v1`，写边界按同一口径收敛：kind 已卸载即丢弃、非法尺寸回退 `defaultSize`、非法 `pos` 归 `null`、`config` 收敛到 schema）；`kernel/widget/geometry.ts` 纯函数网格（`widgetGrid` 右锚定解网格、`spanPx` 换算 sm 160 / md 344 / lg 344×344、`packRight` band 内两列半位流式并在放不下时交出 `overflow`）；`useWidgetContext()`（与 `useWindowContext` 同构的 prop-less 渲染契约，尺寸档由宿主给出而非容器查询反推）。`session.canAccessApp` 更名并收窄为 `canAccess({ permissions? })`，应用与小组件共用同一条鉴权判定。

新增壳层：`WidgetLayer`（算网格、遍历实例、右下角「+N 个未显示」出口）→ `WidgetFrame`（玻璃卡材质 + 尺寸位 + ErrorBoundary/Suspense + 移除入口）→ 开发者组件；`WidgetGallery`（小组件库，懒加载 5.0KB 异步块）是唯一的增删/换尺寸/配置面，桌面右键菜单加「添加小组件」入口。玻璃卡材质类串由此只存在于 `WidgetFrame` 一处（旧壳层手写了三遍），**不进 `src/ui`**——那里是窗口内设计系统（表面档是 `rounded-surface`）。

迁移与 DX：旧 `shell/Widgets.vue` 的时钟/月历/待办迁为 `src/widgets/{clock,calendar,todos}` 三个内置件（`seed: true`，首次运行按 `manifest.seed` 自动上桌面；用户清空过则不再补种），删除 `Widgets.vue`，演示待办数据按「语言包只放界面 chrome」移出 i18n（新增 `widgets.*` chrome 命名空间）。新增 `npm run gen:widget` 生成器、`docs/WebOS小组件开发指南.md` 与文档站 `/guide/widget-development`。小组件不再受 `xl` 断点硬隐藏：改由「能否放下一个完整 band（4 列）」决定，窄到 360px 才整层隐藏。

顺带修两处过程中被门禁拦下的缺陷：`OsSwitch` 是唯一没有 `ariaLabel` 的表单件，已按 `OsSelect`/`OsInput` 同一契约补齐（否则套在外层 label 里时开关没有可访问名）；a11y 的就绪屏障原先只等窗口过渡类，抽屉自身入场动画未跑完时玻璃层半透明会让 `color-contrast` 偶发假失败，屏障改为「无任何 `-enter-active`/`-leave-active`」。

门禁实测：单测 65 文件 / 528 例（新增 48 例），E2E 85 条（非视觉；新增 `widget.spec.ts` 7 条 + a11y 抽屉场景），视觉基线重生成 3 张（shell-light/shell-dark/widget-gallery，已肉眼过），首屏 243.5KB（+8.0KB，预算 700KB），图标白名单 29 个覆盖 25 个用点，42 张 API 表 `docs:check` 一致。明确挂账：拖拽/自由摆放（实例已按锚点相对网格落 `pos` 字段，加拖拽无迁移）、`OsButton` 的 `danger` 变体文字色对比度缺陷（非本次引入，见规划 §8）。
