# Atrium OS 前端架构设计

> 依据产品概念图（Atrium OS 桌面）制定的前端架构设计文档，作为后续脚手架与迭代的唯一设计依据。

## 1. 背景与目标

在浏览器中以 Vue 3 实现一套桌面操作系统形态的 Web 前端：具备桌面外壳（顶栏、Dock、壁纸、桌面图标、Widgets）、多窗口管理、可插拔应用体系、应用间通信与虚拟文件系统，最终承载概念图中的 AI 助手、文档编辑、工作流设计、文件管理、应用中心等应用。

**目标**

- 壳层（Shell）与业务应用解耦：应用以 manifest 注册、懒加载进入窗口，新增应用不改壳层代码
- 窗口管理行为完整：打开、关闭、聚焦、拖拽、八向缩放、最小化、最大化、z 序叠放、状态保持
- OS 级服务下沉为 kernel 层：WindowManager、AppRegistry、CommandBus、VFS、Theme、Persistence
- 应用间以 intent 语义通信（如「AI 助手生成文档 → 打开文档」），不产生组件互引

**非目标（当前阶段）**

- 后端服务与多端同步（VFS 预留 RemoteFS 适配器接口，不实现协议）
- 微前端与应用独立部署（见决策 D1；iframe 类目已由 D2′ 解禁，但仍是同仓 manifest 注册，不是子应用打包）
- 多显示器、跨设备窗口漫游

## 2. 产品形态盘点（源自概念图）

| 区域         | 内容                                                                                                                | 归属层                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 顶栏 TopBar  | 全局菜单（工作台/文件/编辑/视图/应用/窗口/帮助）、全局搜索、通知铃铛、应用启动器、用户头像、网络/电池状态、日期时间 | Shell                         |
| 桌面 Desktop | 壁纸与品牌标语、桌面图标（我的电脑/工作资料/云盘/回收站）、右键菜单                                                 | Shell                         |
| Widgets      | 时钟、月历、今日事项、品牌卡片                                                                                      | Shell                         |
| Dock         | 应用图标、运行中指示、最小化窗口回收                                                                                | Shell                         |
| 窗口         | 标题栏（交通灯/最小化/最大化/关闭）、内容区；示例：AI 助手、文档编辑器、工作流设计器、文件管理、应用中心            | Windows 层渲染，内容来自 Apps |
| 应用间联动   | AI 助手产出文档卡片 →「打开文档」唤起文档编辑器                                                                     | Kernel（CommandBus）          |

## 3. 总体分层

```
┌─ Shell（外壳层）──────────────────────────────────────┐
│ TopBar  Dock  Desktop(壁纸/图标/右键菜单)  WidgetLayer(桌面小组件)  通知中心  Spotlight │
├─ Kernel（OS 服务层：Pinia stores + composables）──────────┤
│ WindowManager  AppRegistry  WidgetRegistry  CommandBus  VFS  Theme  Persistence   │
├─ Windows（窗口渲染层）────────────────────────────────┤
│ WindowFrame(标题栏/边框/缩放把手)  WindowManager(遍历渲染+KeepAlive)  │
├─ Apps（应用层：每个应用 = manifest + 懒加载组件）────────────┤
│ ai-assistant  doc-editor  workflow-designer  file-manager  app-center  settings │
└──────────────────────────────────────────────────┘
```

依赖方向单向：Shell / Windows / Apps 均只依赖 Kernel；Apps 之间不互相依赖，一律经 CommandBus 与 VFS 交互。

## 4. 技术选型

| 项         | 选择                                                 | 理由                                                                                                    |
| ---------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 框架       | Vue 3 + TypeScript + Vite                            | 组合式 API 适合 store 驱动的桌面 UI；TS 保证 manifest/store 契约                                        |
| 状态       | Pinia + pinia-plugin-persistedstate                  | 窗口/应用/主题状态集中管理；布局与设置持久化开箱即用                                                    |
| 工具       | VueUse                                               | useDraggable、useEventListener、useStorage、useRafFn 等减少胶水代码                                     |
| 样式       | Tailwind CSS                                         | 桌面 UI 密度高，原子类效率与一致性最好                                                                  |
| 图标       | lucide-vue-next                                      | 线性 SVG 图标，按需 tree-shake；经 `OsIcon` + `ICON_MAP` 统一出口渲染，`manifest.icon` 为类型安全图标名 |
| 持久化介质 | localStorage（设置/布局）+ IndexedDB（VFS 文件内容） | 文件内容体积大，不入 localStorage                                                                       |

## 5. 核心机制设计

### 5.1 AppRegistry（应用注册表）

应用不直接 import 组件，而以 manifest 声明，组件经动态 import 懒加载：

```ts
interface AppManifest {
  id: string // 'doc-editor'
  name: string // '文档编辑'
  icon: IconName // 类型安全图标名（src/kernel/icons.ts 的 ICON_MAP 键）
  entry: () => Promise<Component>
  window: { w: number; h: number; minW?: number; minH?: number }
  singleton?: boolean // true: 重复打开聚焦既有窗口（AI 助手）；false: 多实例（文档编辑器按 fileId 多开）
  dock?: boolean // 是否固定出现在 Dock
  keywords?: string[] // Spotlight 搜索命中词
}
```

- 注册：`appRegistry.register(manifest)`，启动时集中注册内置应用
- 派生：应用中心网格、Dock 图标、Spotlight 结果、右键菜单「新建」项全部从 registry 派生渲染，**加一个应用只改一处**
- 多实例去重键：`singleton === false` 时以 `appId + payload.key` 判定是否复用窗口

### 5.2 WindowManager（窗口管理器）

```ts
type WinStatus = 'normal' | 'maximized' | 'minimized'

interface WinState {
  id: string // 'win-0001'
  appId: string
  title: string
  x: number
  y: number
  w: number
  h: number
  z: number
  status: WinStatus
  payload?: unknown // 打开时传参（如 { fileId }）
}
```

store actions：`open(appId, payload)` / `close(id)` / `focus(id)` / `minimize(id)` / `toggleMax(id)` / `move(id, x, y)` / `resize(id, rect)`。

关键策略：

- **z 序**：单调递增计数器，`focus` 时 `z = ++topZ`；不做数组重排，CSS z-index 直接取 `z`
- **渲染**：`WindowManager.vue` 遍历 `windows` 渲染 `WindowFrame`；内容区 `<component :is="loadedEntry">` 外套 `<KeepAlive>`，最小化/切走不丢应用内部状态
- **懒加载**：entry 首次 open 时加载，加载期窗口内容区显示骨架屏（Suspense fallback）
- **拖拽**：标题栏 pointerdown 记录偏移 → pointermove 期间用 `transform: translate3d` 跟手（不触发 layout），pointerup 回写 store 的 x/y
- **缩放**：八个 resize handle，同拖拽策略；受 manifest 的 minW/minH 约束
- **最大化**：记录最大化前 rect 以便还原；切换用 CSS transition 做动画
- **边界**：拖拽/缩放结果 clamp 到桌面可视区（顶栏下沿至 Dock 上沿之间至少保留标题栏可见）
- **缓存上限**：KeepAlive 的 max 设上限（如 8），超出按最久未聚焦淘汰，防内存膨胀

### 5.3 CommandBus（应用间通信）

intent 语义的命令与事件总线，命名约定 `应用域:动作`：

```ts
os.exec('doc-editor:open', { fileId })     // 语义命令：WindowManager.open 的封装
os.on('vfs:changed', handler)              // 系统事件：文件增删改后广播
os.emit('ai-assistant:doc-ready', {...})   // 应用事件
```

- `os` 门面经 composable `useOS()` 获取：命令/事件/开窗走门面；数据读写直面 VFS store；应用之间不互相 import
- 未注册命令执行时记入日志并 toast 提示，不抛异常打断调用方
- 实施形态：`commandBus` 为纯事件/命令表（on/emit/exec）；`useOS().exec` 承担 OS 语义——`<appId>:open` 快捷命令直接映射 `WindowManager.open(appId, payload)`，其余命令分发表内 handler；未知应用或未注册命令 `console.warn`、返回 false，并经通知中心推送「命令未执行」提示（已接入）
- `vfs:changed` 事件携带 `{ type, path, from? }`；doc-editor 订阅 rename 事件跟随新路径（`setPayload`），删除/还原由响应式 computed 直接驱动缺失态；通知中心 `boot()` 订阅该事件，remove/restore 分别推送「已删除/已还原」

### 5.4 VFS（虚拟文件系统）

实现形态：pinia store（`kernel/stores/vfs.ts`）+ 节点表 `Record<path, FsNode>`，持久化走 IndexedDB 单键整表快照（`kernel/fs/idb.ts` kv 封装）。落库前必须 `toRaw` 摘除响应式代理，否则 structured clone 抛 DataCloneError。

```ts
interface FsNode {
  path: string
  name: string
  type: 'dir' | 'file'
  size: number
  updatedAt: number
  mime?: string
  content?: string // 文本内容；二进制后续扩 Blob
  trashedFrom?: string // 存在即表示在回收站，值为原父目录
}
// store actions: init / mkdir / writeFile / rename / remove(入回收站) / restore
// getters: ls(dir) / trash / byPath
```

- 删除语义：子树整体移入 `/回收站` 并记 `trashedFrom`，还原时移回（重名自动追加序号）
- IndexedDB 不可用时降级为内存模式并告警，不阻塞应用挂载（挂载不被持久化 gate 死）
- 消费方（文件管理、回收站、后续文档编辑器）只面对 store 接口；将来接后端时以 RemoteFS 适配器替换持久化层，应用层不改
- 变更响应式直达消费方；P2 引入 CommandBus 后再补 `vfs:changed` 事件语义

### 5.5 Theme 与 Persistence

- Theme store：壁纸、强调色、明暗模式；shell 组件经 CSS 变量消费，不允许硬编码色值
- Persistence 范围：窗口布局（位置/尺寸/最小化集合）、用户设置、Dock 固定项、Theme；VFS 内容走 IndexedDB 不进 pinia 持久化
- 实施形态：统一走 `kernel/fs/idb` 的 kv store——`layout-v1` 存窗口快照（appId/title/rect/z/status/prevRect/payload，`toRaw` 后写入），`theme-v1` 存壁纸，`fs-v1` 存 VFS，`widgets-v1` 存小组件实例；windowManager 经 `$subscribe` 防抖 400ms 落盘，启动时在 `mount` 前 `restoreLayout()` 重建窗口（新 id、保留 z 序与最小化态）；恢复的窗口不触发入场动画（TransitionGroup 未开 `appear`）

### 5.6 WidgetRegistry 与桌面小组件

与 AppRegistry **同构但刻意不进窗口体系**：小组件是桌面件（`z-desktop`=5，在窗口层之下），没有 window/dock/category 字段，也不经 `wm.open`。

- **kind 注册**：`src/widgets/<id>/manifest.ts` 导出 `WidgetManifest`，`main.ts` 第三条 `import.meta.glob` 收集，`widgetRegistry.register()` 幂等 + 按 `order` 升序稳定插入 + `markRaw(defineAsyncComponent(entry))`——与应用逐行同构。
- **实例模型**：`src/kernel/stores/widgets.ts`（IDB 键 `widgets-v1`）存 `{ id, kindId, size, pos, config, addedAt }`。`pos` 是**整数网格坐标**（`WidgetCell = {col,row}`，`col` 从视口右缘往左数，见 geometry.ts L-1），`null` = 参与右锚定自动流式（缺省态；新添加恒为 `null`，L-5）。首次手动拖拽时 `pinPositions()` 把全部实例的当前自动格位一次性固化成坐标（台账 C-④），此后 `setPosition` 只在手势落定时写一次（S-4，拖动中每帧不落库），`releasePosition` 清 `pos` 即退回流式（L-9 的显式出口）；桌面顺序的权威是**数组下标**（`move()` 即改下标，`addedAt` 只做元数据）。写边界按同一口径收敛：kind 已卸载的实例丢弃（同 `restoreLayout` 丢未知 appId）、非法尺寸回退 `defaultSize`、非法 `pos` 归 `null`、`config` 收敛到 schema；落库前统一剥掉响应式代理（`snapshot()`）——`filter` 之类重建过的数组元素是代理，IDB 的结构化克隆不认（DataCloneError 会被 catch 吞成一行 warn，属「写了但没写进去」的暗坑）。
- **种类生命周期**：kind 是构建期声明的，但**装不装/开不开是用户状态**，落第二个键 `widget-kinds-v1`（`{ [kindId]: { installed, enabled } }`，无记录即 `{true,true}`）。卸载 = 连带摘掉该 kind 全部实例（同「卸载应用连带关窗」）+ 记未安装（可逆）；停用 = 实例与配置留着、桌面不渲染（停用 ≠ 删除）。
- **派生入口**：两层，别混用——`renderable` 要求「kind 仍注册 + 当前会话可访问 + 未卸载」（列表类入口消费），`visible` 再叠「已启用」（桌面层 `WidgetLayer` 消费，`session.canAccess` 是应用与小组件共用的唯一鉴权判定）。
- **首启种子**：从没落库过实例时，按 `manifest.seed` 铺一批默认件（内置的时钟/月历/待办即由此上桌面）；用户清空过则落库为 `[]`，不再是 `undefined`，不会把删掉的件补回来。
- **几何**：`src/kernel/widget/geometry.ts` 是纯函数——常量 `CELL 68 / GUTTER 24 / MARGIN 24 / BAND_COLS 4` 与 `SIZE_SPAN`（sm 2×2、md 4×2、lg 4×4，任何两件净间距恒＝`GUTTER`，G-1）；`widgetGrid()` 由桌面可用区解出右锚定整数网格，`placeWidgets()` 用**占用网格**同时服务自动流式与手动摆放（`pos=null` 走流式带 sm 半行配对，手动态按坐标占位；装不下/越界/碰撞分别以 `OverflowReason = 'no-space' | 'out-of-range' | 'collision'` 交给 `overflow`，层角给「+N 个未显示」出口，不做静默裁剪）；坐标↔像素换算有 `cellRectToPx / pxToCell / cellsOverlap / canPlace / clampIntoGrid / spanPx / sizePx`；换档只从 kind 已声明的 `sizes` 里挑一档（2026-10-07 起没有连续换档手势，按像素宽度反查档位的 `nearestSize()` 已下线，见功能设计 §8 偏差 29）。**快照（2026-10-06）**：旧口径 `packRight()`（右锚定流式打包）已被 `placeWidgets()` 取代，三档像素值 sm 160 / md 344 / lg 344×344 在新网格下不变。
- **渲染**：`WidgetLayer`（解网格、跑 `placeWidgets`、把 `bandsUsed` 写给 `widgetRuntime` 供标语让位）→ `WidgetFrame`（玻璃材质 + 尺寸位 + ErrorBoundary/Suspense + 网格吸附拖拽 + 键盘等价物 + 卡片右键菜单；**卡片表面不放宿主自绘浮标**——移除与换档都走菜单，`⌥←/⌥→` 是换档的键盘等价物，2026-10-07 摘掉了右上角「×」与右下角拖角手柄，见功能设计 §8 偏差 29）→ 开发者组件。组件是 **prop-less** 的，经 `useWidgetContext()` 读上下文 `{ instanceId, instance, manifest, config, size, padding, selected, setSelected, preview, visible }`；上下文由**单一注入键** `WIDGET_CONTEXT_KEY` 传递，本体由容器侧 `createWidgetContext()`（真实实例）或 `createPreviewWidgetContext()`（预览沙箱 mock，不进实例表、不查 store）建好后 `provideWidgetContext()` 注入——少了这一层，沙箱就只能往实例表塞假数据。尺寸档是宿主已知的离散值，直接按 `size` 分支而不走容器查询反推。
- **件内通道（composables）**：`useWidgetData`（读 `manifest.data` 声明的 VFS 键，300ms 防抖 + 乐观更新回滚 + `snapshot()` 剥代理 + 工厂首读建文件）、`useWidgetTick`＋`kernel/widget/scheduler.ts`（**全局共享计时器**：`subscribeTick(ms)` 同周期合并订阅，TICK_SECOND/HALF_MINUTE/MINUTE 三通道；`visibilitychange` 经 `setSuspended()` 暂停；`REFRESH_PERIOD` 把 `manifest.refresh`（live/minute/hour/day/manual）解成检查周期，`day` 以日期串变化为准，回到前台补扫）、`useWidgetStatus`（visible/overflow/disabled/lastRefreshAt/refreshCount）、`useWidgetConfigPanel`（`configEntry` 自绘面板与宿主之间的 draft/commit 通道）、`useWidgetDrill`（`openAppId` 可为 `{ appId, payloadFor? }`，下钻前经 `os.can` 门禁）。数据文件统一落在 VFS `/我的数据/`（`widgetData.ts` 的 `DATA_ROOT/widgetDataPath`），待办与「今日」应用共读 `tasks.json`/`events.json` 而互不 import（`taskSchedule.ts` 为唯一契约层，台账 C-③）。
- **卡片材质归属**：唯一一份类串在 `kernel/widget/material.ts` 的 `WIDGET_CARD_CLASS`（`rounded-dock + bg-widget-surface + border-widget-border + shadow-dock + backdrop-blur-xl + text-widget-ink`），桌面卡片与预览沙箱共用它；表面色走 `--color-widget-*` 七档 token（surface/ink/ink-mute/ink-disabled/line/fill/border，两套主题各定义一遍，与主题表面同源——功能设计 D13），**不进 `src/ui/`**（那里是窗口内设计系统）。`widgetPaddingClass()` 按 `manifest.padding` 给 `p-widget / p-widget-compact`（`--spacing-widget 16px / --spacing-widget-compact 11px`），内边距由宿主给、件侧不可声明。旧壳层曾把玻璃类串手写三遍，现收敛到这一处。
- **管理面**：一处实现 `src/components/WidgetConsole.vue`（外壳无关，故落在 `src/components` 而不是 `src/ui`），两个入口共用它——抽屉 `shell/WidgetGallery.vue`（桌面侧快改）与「小组件中心」应用（种类台账）。§4.8 合一视图已接线（2026-10-07 核对）：搜索框消费 `keywords`+名称+描述、无权限 kind 走灰态行（`inaccessibleWidgets` + 「需要哪个角色」反查）、目录行＝预览缩略 + 一行描述 + 支持档位 + `tint` 添加钮（尺寸选择收进添加弹层，A-4）、实例行＝预览 + 换档 + 就地展开配置 + 排序把手（流式生效、手动态置灰 L-9）+「未在桌面显示」成因、数据段盘点 `/我的数据` 孤儿文件并可清理。配置控件缺省由宿主按 `manifest.config` schema 渲染；声明了 `configEntry` 的件自绘面板。`WidgetConfigPanel.vue` 两类宿主共用——`WidgetLayer.vue` 的弹层（卡片菜单「配置…」，不走 `OsDialog`——其取消/确认与面板页脚的恢复默认/完成重复）与实例行的就地展开（抽屉与中心经 `WidgetConsole` 再共用），「三处共用」成立（§4.12）。
- **右键菜单**：壳层单例通道 `shellUi.contextMenu`（`openContextMenu(x, y, items)`），宿主 `shell/ContextMenu.vue` 挂在 App 根级。挂根级不是随手定的——小组件层自身是 `z-desktop` 的层叠上下文，弹层挂在层内会被窗口（`z-window`）盖住；单例也让桌面菜单与卡片菜单不会叠在一起。条目是数据驱动的（`checked` / `danger` / `separatorBefore`），位置按实测宽高夹取。材质沿用壳层玻璃（`bg-glass-pop`），**不复用**窗口内的 `OsMenu`（实底表面 + 键盘委托属设计系统那套）。
- **生成器**：`npm run gen:widget` 交互问答（id/名称/图标/tint/档位/下钻/单例/描述）产出 `src/widgets/<id>/{manifest.ts,App.vue,preview.json}`，并同步写两份语言包的 `widgets.names.*`/`widgets.descriptions.*` 叶子，末尾直接跑 `check-widget-contract`（T5/T9/T12）；准入四格以注释模板带出，`description` 没给答案时出 TODO 模板句等 author 清零。与 `gen:app` 同构。

## 6. 目录结构

```
src/
├─ shell/                  # 外壳层
│  ├─ TopBar/              #   全局菜单、搜索入口、状态区、时钟
│  ├─ Dock/
│  ├─ Desktop/             #   壁纸、桌面图标、右键菜单
│  ├─ WidgetLayer.vue      #   桌面小组件宿主：placeWidgets 求解 + 溢出出口 + 标语让位 + configEntry 配置弹层
│  ├─ WidgetFrame.vue      #   单实例壳：卡片材质、错误/加载兜底、网格吸附拖拽、键盘等价物、卡片右键菜单（表面不放浮标）
│  ├─ WidgetGallery.vue    #   小组件库抽屉（懒加载）：只是 WidgetConsole 的抽屉外壳
│  ├─ ContextMenu.vue      #   壳层右键菜单宿主（单例）：桌面菜单与小组件卡片菜单共用
│  ├─ NotificationCenter/
│  └─ Spotlight/           #   全局搜索面板
├─ components/             # 壳层与应用共用的展示/面板件（OsIcon OsAppTile WidgetConsole WidgetPreview WidgetConfigPanel WidgetConfigFields WidgetCatalogRow WidgetInstanceRow）
│  └─ WidgetConsole.vue    #   小组件管理台：实例段 + 种类段（抽屉与小组件中心共用）
├─ kernel/
│  ├─ stores/              #   windowManager.ts appRegistry.ts widgetRegistry.ts widgets.ts widgetRuntime.ts webApps.ts vfs.ts theme.ts notification.ts session.ts settings.ts shellUi.ts
│  ├─ bus/                 #   commandBus.ts
│  ├─ widget/              #   geometry.ts（网格常量 + placeWidgets 等纯函数）scheduler.ts（共享计时器 + REFRESH_PERIOD）material.ts（卡片材质单点）configText.ts taskSchedule.ts（tasks/events 数据契约）widgetData.ts（/我的数据 路径层）previewSamples.ts previewBudget.ts usePlacementGestures.ts（拖拽摆放手势）host.ts
│  ├─ webapp/              #   url.ts：外部网页应用的地址校验归一（安全边界，纯函数）
│  └─ composables/         #   useOS.ts useWindowContext.ts useWindowDrag.ts useWindowResize.ts useWidgetContext.ts useWidgetData.ts useWidgetTick.ts useWidgetStatus.ts useWidgetConfigPanel.ts useWidgetDrill.ts
├─ widgets/                # 桌面小组件（每件：manifest.ts + App.vue，自绘配置面者另有 Config.vue）
│  ├─ clock/               #   时钟（sm/md/live）
│  ├─ calendar/            #   月历（md/lg/day 刷新/交互型，下钻「今日」）
│  ├─ todos/               #   待办（md/lg/交互型，与「今日」应用共读 tasks.json）
│  ├─ control-center/ storage/ recent-files/ system/ sticky-note/  # 批次 B 五件
│  ├─ notification-summary/ data-summary/                          # 批次 C 两件
│  └─ gate-smoke-widget/   #   门禁烟测件（契约扫描哨兵，非用户件）
├─ windows/
│  ├─ WindowFrame.vue      #   标题栏、交通灯、边框、缩放把手
│  ├─ EmbedView.vue        #   外部网页应用内容区（唯一 iframe 落点，D2′）
│  └─ WindowManager.vue    #   遍历渲染 + KeepAlive + Suspense
├─ apps/
│  ├─ ai-assistant/        #   每应用：manifest.ts + App.vue + 内部组件
│  ├─ doc-editor/
│  ├─ workflow-designer/
│  ├─ docs-center/         #   内置 embed 应用样板：manifest 只声明 embed.url，无 App.vue
│  ├─ widget-center/       #   小组件中心：种类台账（安装/启用/卸载），面板复用 components/WidgetConsole
│  ├─ today/               #   「今日」应用：月历/待办下钻的落点（消费 {date}/{scope} payload，读同一份 tasks/events）
│  ├─ file-manager/
│  ├─ app-center/
│  └─ settings/
├─ assets/                 # 壁纸、品牌资源
├─ styles/                 # 全局样式、CSS 变量
├─ entry.ts                # 模块入口：反嵌套守卫判定后才动态导入 main（被嵌入时内核不求值）
└─ main.ts                 # 装 pinia/persistedstate，注册内置应用，挂载 DesktopRoot
public/
└─ docs/                   # docs:embed 同步的 VitePress 产物（构建期生成，gitignore）
```

## 7. 实施路线

| 阶段              | 内容                                                                                                                               | 验收标准                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| P0 骨架           | Vite+TS+Pinia 脚手架；Desktop/TopBar/Dock 静态壳；WindowManager MVP（open/close/focus/拖拽/缩放/z 序/最大化/最小化）；2 个占位应用 | 从 Dock 点开两个窗口，可拖拽、叠放、聚焦、最小化到 Dock、最大化还原     |
| P1 应用体系       | AppRegistry 全量落地；应用中心；VFS（IndexedDBFS）+ 文件管理应用；KeepAlive/懒加载/缓存上限                                        | 应用中心网格由 registry 派生；文件管理可建目录/新建/重命名/删除入回收站 |
| P2 联通与外壳增强 | CommandBus；AI 助手→文档编辑器链路；通知中心；Spotlight；Widgets；桌面右键菜单                                                     | AI 助手产出文档卡片，点「打开文档」唤起编辑器并加载该文件               |
| P3 打磨           | 布局持久化；Theme/换壁纸；窗口开合动画；拖拽边界与多窗口排布优化                                                                   | 刷新后窗口布局与设置还原；换壁纸全局生效                                |

## 8. 关键决策

| 编号 | 决策                                    | 结论与理由                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1   | 应用隔离方式                            | **同仓组件 + manifest 懒加载**。通信直接、样式统一、可做毛玻璃与统一动画；微前端（wujie/module-federation）留作将来应用需独立部署时的演进方向                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| D2′  | 窗口内容渲染                            | **默认纯 DOM；iframe 只允许作为「外部网页应用」的内容区实现**（收窄自原 D2「纯 DOM，不用 iframe」）。半透明材质、统一窗口动画、标题栏与错误边界都依赖同文档渲染，因此**壳层与自研应用永远走 DOM**；需要承载用户提供的第三方站点时，唯一可行手段是 iframe，故把它限定在 `AppManifest.embed` 声明的类目里，由 `src/windows/EmbedView.vue` 一处实现，不参与壳层材质与动画。**代价（明确接受）**：frame 内文档不被我们的主题/动效/ErrorBoundary/i18n 覆盖，跨源内容读不到（标题、历史、滚动位置都不能回读）                                                                                                                                                                                                                                                                                                |
| D3   | z 序管理                                | 单调递增计数器（focus 时 `z = ++topZ`），避免数组重排与全量重渲染                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D4   | 单例/多实例                             | 由 manifest `singleton` 声明；多实例以 `appId + payload.key` 去重复用                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D5   | 拖拽/缩放性能                           | 跟手阶段走 transform，pointerup 回写 store，避免 pointermove 高频触发全树响应式更新                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D6   | Dock 点击语义                           | 聚焦中→最小化；存在最小化→还原；否则新开（P0 实测补）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D7   | 组件入 store                            | `markRaw` 包裹异步组件，禁止组件对象被响应式化                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D8   | 持久化与挂载                            | VFS 落库前 `toRaw`；IDB 不可用降级内存模式，挂载不被持久化 gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| D9   | 统一图标出口                            | 不用 emoji；lucide-vue-next 经 `OsIcon` + `ICON_MAP` 收口渲染，`manifest.icon` 为类型安全图标名，文件类型图标（含配色）由共享 `fileIconName/fileIconClass` 派生                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| D10  | 小组件形态                              | **小组件 = 桌面件，不进窗口体系**：独立 `src/widgets/` 目录 + `WidgetRegistry`/`widgets` 两个 store + 右锚定自动流式网格（`kernel/widget/geometry.ts` 纯函数）。理由：小组件要的是「贴桌面、在窗口之下、由用户增删」，借窗口体系实现会把 `layout-v1` 污染成两套语义；卡片材质归壳层 `WidgetFrame` 一处（不进 `src/ui/`）；实例摆放用锚点相对网格，v1 无拖拽但字段先立，加拖拽无迁移。代价（明确接受）：v1 不含拖拽/自由摆放，也不给小组件专属容器查询变体（尺寸档由宿主经 context 给出）。**2026-10-07 更新**：拖拽与换档已按《AtriumOS小组件功能设计》§4.7 落地（吸附式，非像素级自由态，见 D15；换档的载体先是拖角手势，同日撤为卡片菜单档位组 + `⌥←/⌥→`，见功能设计 §8 偏差 29），材质单点也从 `WidgetFrame` 上移到 `kernel/widget/material.ts`（预览沙箱要共用）；「不给容器查询变体」的代价仍成立 |
| D11  | 小组件管理面收敛                        | 见 §10 实施状态「小组件管理面与卡片菜单（D11）」与本文「实施期对设计的修正」：管理台单点 `components/WidgetConsole.vue`、kind 生命周期 `widget-kinds-v1`、右键菜单壳层单例通道 `shellUi.contextMenu`（挂 App 根级越过小组件层的层叠上下文）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| D12  | 小组件数据归属＝VFS                     | **件内交互写的是文件系统，不是组件内存**：`manifest.data` 声明 `{ key, scope: 'shared'                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 'instance' }`，实际落点统一在 VFS `/我的数据/`（`widgetData.ts` 给路径，`useWidgetData`给读写通道，乐观更新 + 回滚 + 坏 JSON 容错）。待办勾选、便签内容都不再从`ref`里蒸发（首轮走查实测教训：勾选 reload 即丢）。删除小组件实例**不删数据**（删件不删数据，功能设计 §4.2 规则 5）；「今日」应用与待办件共读同一份`tasks.json`/`events.json`、互不 import（`taskSchedule.ts` 是唯一契约层） |
| D13  | 小组件表面＝主题同源 token 层           | 卡片前景不走「白字浮在玻璃上」的老路，而是 `--color-widget-*` 七档 token（surface/ink/ink-mute/ink-disabled/line/fill/border；功能设计 §4.10 写「六档」，实现多列了 border 一档），raw 值在 light/dark 两套主题各定义一遍、前景与表面**同层派生**。取值原则：**卡片必须自带可读底**，不把可读性外包给壁纸——`backdrop-blur` 只负责质感不负责可读性（浅色 `.72` 白、深色 `.62` 深蓝，比 `glass-bar` 实一档）。次级/禁用前景是不透明灰度档而非裸 `opacity-*`（(HIG) A-8）。收益：对比度可算（T3 对解析色断言）；代价：件作者只能用 token 类不能用裸色（指南 §10 禁止事项）                                                                                                                                                                                                                                |
| D14  | 内容纪律以 Apple HIG Widgets 为参照系   | **小组件「该放什么」有明文纪律**（功能设计 §4.0/§4.5，指南新增「内容纪律」一节）：每档有内容预算（R1–R4）、描述动词开头禁自指（H-5）、配置 ≤3 且默认即自动（H-9）、颜色不承载唯一语义（H-3）、卡片内不放 App 图标（H-11 同源约束含件内圆角不得与 `rounded-dock` 同值）。理由：本项目是 Apple HIG 语境的桌面/Web **变形采纳**，不照搬四形/色调/全天候显示（逐条「不做」见功能设计 §7）；半成品感的源头是「只讲契约字段、不讲该放什么」                                                                                                                                                                                                                                                                                                                                                                  |
| D15  | 摆放与尺寸共用「整数网格 + 离散档」模型 | **一切排布改动都是坐标/档位取值，不引入像素级自由态**：拖拽吸附到 `WidgetCell = {col,row}`（col 从右缘数，视口变窄贴右的仍贴右），换档只取 kind 已声明的 `sizes`（离散、无中间态）；自动流式与手动摆放入同一函数 `placeWidgets()`（占用网格模型，碰撞拒绝 + 回弹，L-3/L-7/L-8），净间距恒等于 `GUTTER`（G-1）。理由：像素级自由摆放会让间距守不住、`pos` 随视口漂移，且放开任意 span 会使逐档内容预算（D14 的 R1–R4）整体失效——这是功能设计决策 9 里唯一会「重做几何」的岔路，已明确不走                                                                                                                                                                                                                                                                                                               |

**开放问题**

- RemoteFS 与后端的协议形态（REST/WebSocket）待后端立项后定义
- 应用规模增长后是否拆独立仓库（module-federation），以应用数量 > 15 为评估触发点

## 9. 风险与对策

| 风险                        | 对策                                                                                                                                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 多窗口 + KeepAlive 内存膨胀 | KeepAlive max 上限 + 最久未聚焦淘汰；应用卸载时经 onUnmounted 清理订阅                                                                                                                                                       |
| pointermove 高频更新卡顿    | 见 D5；必要时 useRafFn 合帧                                                                                                                                                                                                  |
| 应用样式污染壳层            | 应用根组件 scoped + 命名前缀约定；全局样式只放 CSS 变量与 reset                                                                                                                                                              |
| 应用间隐式耦合              | 强制经 CommandBus/VFS；code review 检查 apps/ 之间无互相 import                                                                                                                                                              |
| 持久化数据版本演进          | persistedstate 键带版本号，启动时迁移或丢弃旧版                                                                                                                                                                              |
| 外部站点拒绝被嵌入          | 拒绝在跨源 frame 里表现为画面空白 + 照常 `load`（实测 google：响应 200、`load` 触发、内容空且父页读不到），**不可靠检测**；因此不做伪检测，加载超时给 warning + 「新标签页打开」出口，限制在添加弹窗文案与工具栏常驻出口明示 |
| embed 内容越权              | 地址在写入边界（webApps.add）做正向协议白名单 http/https；`sandbox` 故意不给 `allow-top-navigation`（拦 frame-busting）；`src` 只做属性绑定，不进 `v-html`/标题插值，本阶段不注册任何 postMessage 监听                       |

## 10. 实施状态

| 阶段                 | 状态                 | 说明                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0 骨架              | 已完成（2026-10-04） | 壳层 + 窗口管理全行为浏览器实测通过                                                                                                                                                                                                                                                                                                                         |
| P1 应用体系          | 已完成（2026-10-04） | AppRegistry 派生应用中心；VFS + 文件管理 CRUD/回收站/还原；IndexedDB 持久化刷新验证通过                                                                                                                                                                                                                                                                     |
| P2 联通与外壳增强    | 已完成（2026-10-04） | CommandBus + useOS（`appId:open` 语义快捷、未注册命令回退通知）+ doc-editor + AI 助手→打开文档链路 + vfs:changed 事件；通知中心（vfs 删除/还原、AI 生成文档触发，未读角标 + 打开即已读）、Spotlight（⌘K/搜索钮唤起，应用+文件检索→唤起）、Widgets（时钟/月历今日高亮/今日事项，窄屏隐藏）、桌面右键菜单（层叠窗口/更换壁纸/打开应用中心）全部浏览器实测通过 |
| P3 打磨              | 已完成（2026-10-04） | Theme store + 三套壁纸切换（右键菜单驱动）；窗口布局持久化（位置/尺寸/z/最小化集合/标题/payload，`layout-v1`）+ 壁纸持久化（`theme-v1`），刷新后精确还原；窗口开合动画（TransitionGroup `.win-*` opacity+scale，覆盖 section 的 transition 工具类）； Dock 固定项/多用户设置暂无对应功能，不在本期范围                                                      |
| 图标系统改造         | 已完成（2026-10-04） | 全仓 emoji 图标（4 个 manifest + 17 处 UI 硬编码）替换为 lucide-vue-next 线性图标，经 `OsIcon` + `ICON_MAP` 收口；Dock 磁贴保持 tint 渐变 + 白色线图标；文件类型图标/配色由 `fileIconName/fileIconClass` 共享（file-manager 与 Spotlight 一致）；vue-tsc + 浏览器实测通过                                                                                   |
| 工程基建打底         | 已完成（2026-10-04） | 详见《AtriumOS设计规范与工程基建.md》：ESLint/Prettier/husky 门禁、Vitest 单测（45 例）、Playwright E2E 冒烟（6 例，均为打底时点读数，现状见《AtriumOS对标AntDesign迭代规划.md》§9）、GitHub Actions CI、设计 token 化（`src/styles/tokens.css`）、`src/ui/` 基础组件收口                                                                                   |
| 后续迭代路线         | 已规划（2026-10-04） | P0~P3 与打底完成后的脚手架方向路线（S1 应用接入契约与生成器 / S2 权限模型与 settings / S3 组件纵深 / S4 数据访问层 / S5 主题与 i18n / S6 文档站·版本·可观测）详见《AtriumOS脚手架迭代路线.md》，该文档为后续迭代的设计依据                                                                                                                                  |
| 对标 Ant Design 纵深 | 进行中（2026-10-05） | S1~S6 之后以 Ant Design 的设计/研发/组件体系为参照另文规划 S7~S12（设计语言成文与 token 刻度、组件契约、布局与展示件、反馈与导航件、配置层与文档自动化、a11y 与质量线），详见《AtriumOS对标AntDesign迭代规划.md》；S7~S11 已完成，逐阶段状态见该文档 §9                                                                                                     |

| 外部网页应用类目 | 已完成（2026-10-05） | D2′ 落地：`AppManifest` 加 `embed` 与 `entry` 二选一（`register()` 合成内置 `EmbedView`，渲染路径仍一条），新增 `webApps` store（`webapps-v1`）持久化用户在应用中心「网页应用」分区添加的外部站点，内置 `docs-center` 以 `embed: { url: '/docs/index.html' }` 指向同源文档站（`docs:embed` 把 VitePress 产物复制进 `public/docs/`；同源入口必须带扩展名，故壳层加了「被嵌入即拒绝挂载」的反嵌套判断）；跨源拒绝嵌入不做伪检测，走超时告警 + 新标签页出口（两类结局均已浏览器实测：同源 fixture 与文档站正文可读；`https://www.google.com` 因 `x-frame-options: SAMEORIGIN` 拿到 200 + 触发 `load` 却画面空白，界面如实停在就绪态、工具栏「重试 / 新标签页打开」始终可用，卸载后刷新不复活）。**门禁实测**：单测 60 文件 / 479 例（新增 `webapp-url` 21 + `webApps` 10 + `embed-view` 9 + `web-apps-panel` 5 + 双语 key 齐平 1），E2E 84 条全绿（77→84：`web-app.spec.ts` 6 条走「添加 → Dock 磁贴 → `frameLocator` 读到同源正文 → 刷新仍在 → 卸载连带关窗且刷新不复活 → `javascript:` 被字段错误拦下 → 内置文档中心渲染同源文档站首页 → 访客角色不收窄 embed 类目」，另 1 条为 a11y 的网页应用三场景扫描），首屏 235.5KB（预算 700KB）、最大单块 `vue` 147.7KB（预算 260KB）、`EmbedView` 独立异步块 2.8KB，图标白名单 28 个覆盖 24 个用点，42 张 API 表 `docs:check` 一致。**反证（证明门禁不是摆设，跑完即撤）**：manifest 里把图标写成 `nope` → `gen-icons --check` exit=1；`entry`+`embed` 同时给出由 `@ts-expect-error` 用例锁住（指令一旦失效 vue-tsc 即报错）；语言包删一条 en key → 双语齐平用例如期报出 `webApp.add`；面板里把拒绝原因路径写回错的 `webApp.reason.tooLong` → 组件用例报出「显示成 key 而不是文案」；把 `webApps.toManifest()` 的 `permissions` 从 `[]` 改成 `['fs:read']` → 访客角色用例如期报出新磁贴消失（哨兵不是摆设：它先证明角色真变了，再证明公开类目没被顺手收窄）。**2026-10-06 做实（D2′ 同一条决策链的补充）**：口径从「同源入口必须带扩展名」放宽为**三层运行链**（① 带扩展名的真文件地址 ② `vite.config.ts` 内联插件 `serve-embedded-docs` 按存在性重写 dev/preview 两侧的目录根与无扩展名深链 ③ 都没兜住的落 `main.ts` 反嵌套守卫），`predev` 挂 `embed-docs --if-missing` 使全新克隆首开即有文档站正文（并顺带自愈没挂 `pretest:e2e` 的 a11y/visual 两个 job）；文档站开出本地搜索（`search.provider='local'` + `options.translations` 中文文案）与根级 `lastUpdated`，补 `/tokens`·`/architecture` 参考侧栏；⌘K 与 `/` 的归属写进指南（frame 内焦点归文档站内搜索，**不**由父层接管快捷键）。**本轮门禁实测**：`tests/e2e/docs-deep-link.spec.ts` 6 条（首开 `.VPHome` 在场 + 内链三形态盘点 + 搜索触发件装配 + `/docs/`、`/docs/components/`、`/docs/tokens` 三条硬导航各锁 `html[data-atrium-guard]` 计数 0），dev 与 preview 两侧 curl 矩阵确认三种形态都落真页面；`docs:embed` 1.6s，搜索新增 `@localSearchIndexroot` 与 `VPLocalSearchBox` 两个**懒加载** chunk ≈201KB 全落 `dist/docs`（`check-bundle.mjs` 只扫 `dist/assets`），OS 首屏（纯检出实测 235.5KB）与最大单块 `vue` 147.7KB 均不回归；42 张 API 表 `docs:check` 一致。**反证（跑完即撤）**：摘掉中间件 → 三条硬导航红；摘掉 `search.provider` → frame 内触发件断言红；把 `en-US` 的 `apps.docEditor` 改回 `'Docs'`（与 `apps.docsCenter` 撞名）→ 本轮新增的「同一语言内 `apps.*` 取值不得重复」单测红并逐条报出撞名 key。口径修正：`website/index.md` 与 `website/architecture.md` 的组件数 18 → 41（`docs/AtriumOS对标AntDesign迭代规划.md` §3 的 18/31 属规划时点快照，不回改，只在注尾加指针）。 **守卫做实（同日 B 线）**：反嵌套判定从 `main.ts` 的启动链尾上移到新的 `src/entry.ts`（`index.html` 的模块脚本改指它），判定通过才 `void import('./main')`——被嵌入的那份文档连内核模块图都不求值。降级页按成因分两态（`docs-fallback` 处方 `npm run docs:embed` / `self-embed` 处方「同源入口要写成真实文件地址」），双语用并列 `<p lang>`（此刻 i18n 还没 boot），样式走 `main.css` 新增的 `.embed-guard*` + 既有 token，恒浅色（不启动 store 就拿不到 `theme-v1`，为一张说明页引入状态依赖不值）。上移的必要性是状态污染而非观感：旧形态里内层照样跑 `theme.restore/vfs.init/webApps.restore/wm.restoreLayout`，而 `wm.$subscribe → schedulePersist` 的 400ms 防抖会把内层刚恢复出的旧快照写回同一份 `layout-v1`。**这条断言的设计过程本身是一次实测修正**：原计划按「刷新后少一个窗口」断言，实测发现（a）全新上下文里 `layout-v1` 为空，内层 `restoreLayout` 原样早退、一次都不写，那样的绿是假的，故用例里先开一扇窗并等 700ms 落一次非空布局作前置；（b）内层与外层各持一个 400ms 防抖，谁后落盘取决于模块图加载耗时，dev 下外层几乎总是赢——于是断言换成「谁写的」：`page.addInitScript` 在每个文档里给 `IDBObjectStore.prototype.put` 记账，断言内层对 `layout-v1` 零写入（无条件不变量），`reload` 后窗口仍在只作可读性佐证。**本轮门禁实测**：`tests/unit/embed-guard.test.ts` 新增 8 例（成因判别含「`/docsx` 不算文档站」、两态处方互斥、挂载残留被清）；`docs-deep-link.spec.ts` 由 6 条增至 9 条（守卫两态各锁处方文案 + 一条「卡片有边框」的反裸文本断言 + 一条零副作用）。**反证 2**：把守卫挪回 `.then()` 链尾 → 零副作用条红（实测 `Received: 1`），跑完即撤。包体口径连带修正：入口拆出后 `main.ts` 成为独立 chunk，`check-bundle.mjs` 的首屏定义从 `index+vue+vendor` 改成 `index+main+vue+vendor`（`git worktree` 纯检出实测：入口 4.2 + 壳层 `main` 77.7 + `vue` 147.7 + `vendor` 8.3 = 237.9KB / 预算 700KB，比拆分前同一口径的 235.5KB 多 2.4KB（入口块本身与动态导入的包装），最大单块仍是 `vue` 147.7KB；先前写进文档的 243.5 / 249.6 / 89.3 出自共享工作区——那棵树同时带着另一条线未提交的壳层改动，`main` 块因此虚高 11.6KB，包体读数一律以干净检出为准），漏算 `main` 等于凭空少掉整个壳层；顶层首屏因此多一跳往返，代价写在 `src/entry.ts` 注释里。 |
| 桌面小组件体系（D10） | 已完成（2026-10-06） | 详见《AtriumOS小组件开发指南.md》。落地：`WidgetManifest` 契约 + `widgetRegistry`（kind）+ `widgets`（实例，`widgets-v1`）+ `kernel/widget/geometry.ts`（网格纯函数）+ `WidgetLayer`/`WidgetFrame`/`WidgetGallery` 三件壳层组件 + `src/widgets/{clock,calendar,todos}` 三个内置件（由旧 `shell/Widgets.vue` 迁移，删除该文件并把手写的玻璃类串收敛进 `WidgetFrame` 一处）+ `gen:widget` 生成器 + 桌面右键「添加小组件」入口 + 首启按 `manifest.seed` 铺默认件。**门禁实测**：单测 65 文件 / 528 例（新增 `widgetRegistry` 8 + `widgets` 15 + `widget-geometry` 13 + `widget-frame` 5 + `widget-gallery` 7），E2E 85 条（非视觉；新增 `widget.spec.ts` 7 条走「首启种子 + 右锚定贴边 → 层级在窗口之下 → 交互件收到点击 → 卡片间隙右键仍弹桌面菜单 → 本体右键开库 → 按尺寸添加并刷新仍在 → 移除后刷新不复活」，a11y 加「小组件库抽屉」场景），视觉基线重生成 3 张（`shell-light`/`shell-dark`/`widget-gallery`）；首屏 243.5KB（+8.0KB，预算 700KB），`WidgetGallery` 按计划切成独立异步块 5.0KB，图标白名单 29 个覆盖 25 个用点，42 张 API 表 `docs:check` 一致。**过程中被门禁拦下并修掉的两处**：① `WidgetFrame` 初版漏了 `pointer-events-auto`，玻璃卡片收不到指针事件（e2e hover 报「壁纸拦截指针」）；② 小组件库的 `OsSwitch` 无可访问名——`OsSwitch` 是唯一没有 `ariaLabel` 的表单件，已按 `OsSelect`/`OsInput` 同一契约补齐（并重生成该组件的 API 表）。**已知缺陷（非本次引入，已记入开放问题）**：`OsButton` 的 `danger` 变体用语义 seed 作文字色，实底上仅 3.67:1 |
| 小组件管理面与卡片菜单（D11） | 已完成（2026-10-06） | 卡片右键由「直开抽屉」改为**卡片菜单**（尺寸档勾当前档 / 打开应用 / 管理小组件… / 移除）；菜单做壳层单例通道 `shellUi.contextMenu` + `shell/ContextMenu.vue` 挂 App 根级（越过小组件层 `z-desktop` 的层叠上下文，单例保证不与桌面菜单叠加，条目数据驱动 `checked`/`danger`/`separatorBefore`，位置按实测宽高夹取）；管理台抽到 `components/WidgetConsole.vue`，抽屉收薄（宽 420）+ 新应用 `apps/widget-center/`（`puzzle`，glob 自动注册进 Dock/应用中心/Spotlight）共用同一份面板；`widgets` 增 kind 生命周期（IDB `widget-kinds-v1`，缺省全装全开，卸载连带摘实例可逆、停用只隐藏，派生 `renderable`/`visible` 两层）。**门禁实测**：单测 66 文件 / 549 例（本次新增 19 例），E2E 107 条全绿（a11y 9 场景含新增「小组件中心」「卡片菜单」两个扫描面，视觉 13 张含新增 `widget-center.png`，Dock 磁贴连带重生成 5 张已肉眼过），首屏 247.1KB（预算 700KB），11 个应用异步 chunk，42 张 API 表一致，token 审计 129 文件通过。**实测揪出的真 bug**：`uninstall` 用 `filter` 重建实例数组使元素成为响应式代理，IDB 结构化克隆抛 `DataCloneError` 被 `persist` 的 catch 吞成一行 warn（界面靠 kind 状态看着正常，数据没落库、刷新即复活）——修在写边界（`snapshot()` 剥代理），并把单测 IDB mock 换成 `structuredClone` 让同类问题按真库口径暴露 |
| 小组件功能线（D12~D15 落地） | 已完成（2026-10-07） | 《AtriumOS小组件功能设计.md》§4.5–§4.12 全量实现并回写：`WidgetManifest` 扩 `descriptionKey/padding/refresh/data/configEntry/interactive/openAppId(可带 payloadFor)`；上下文单键 `WIDGET_CONTEXT_KEY` + 预览沙箱 `createPreviewWidgetContext`；composables 五件套（data/tick+status/configPanel/drill）+ 共享调度器 `scheduler.ts`（`REFRESH_PERIOD`、`visibilitychange` 暂停、回前台补扫）；`placeWidgets()` 占用网格取代 `packRight()`，拖拽/离散换档/键盘等价物（Enter/Delete/⌥←→/⌘⇧方向/⌘][）/桌面速览 ⌘⇧D/标语让位（`widgetRuntime.bandsUsed`）全部接线；批次 B 五件 + 批次 C 两件 + 「今日」应用上架（内置件 10 个 + 门禁哨兵 1 个）。门禁读数（单测/E2E/包体）以主线同批记录为准，本行不重复抄数；实现偏差 9 条逐条写在功能设计 §8「实现偏差」，残项（`focusInstanceId` 的传 id 调用方、生成器 TODO 模板句、视觉基线一次性重生成等）记入上方开放问题 |

**实施期对设计的修正（已回写本文档）**

- D6：Dock 点击语义 = 聚焦中最小化 / 有最小化还原 / 否则新开（`restore` action）
- D7：异步组件入 store 前 `markRaw`，避免组件对象被响应式化
- D8：VFS 落库前 `toRaw`；IDB 不可用降级内存模式，挂载不被持久化阻塞（5.4 已述）
- D2→D2′：需求「把外部站点当应用」推翻原「不用 iframe」；渲染改为单一入口 + `AppManifest.entry`/`embed` 二选一，iframe 只在 `EmbedView` 一处出现，壳层材质与动画不受影响（详见《AtriumOS应用开发指南.md》「外部网页应用」）
- D10：桌面小组件体系（《AtriumOS小组件开发指南.md》）：小组件从「壳层里手写的三张卡片」升级为可注册模块——`src/widgets/` 约定收集 + 独立 `widgetRegistry`/`widgets` store + 右锚定自动流式网格 + 小组件库增删 + `gen:widget` 生成器；实例增删不涉及窗口与 `layout-v1`，鉴权与内置应用共用 `session.canAccess`
- D11：小组件管理面收敛与卡片菜单：管理台抽到 `src/components/WidgetConsole.vue`（外壳无关），抽屉与新增的「小组件中心」应用共用一份实现；种类生命周期（安装/**启用**/卸载）落 `widget-kinds-v1`，走 `renderable`/`visible` 两层派生；右键菜单改为壳层单例通道 + 数据驱动条目（`shellUi.contextMenu` + `shell/ContextMenu.vue` 挂 App 根级，越过小组件层的层叠上下文）
- D12~D15：小组件功能线（《AtriumOS小组件功能设计.md》）落地后补进 §8 决策表——数据归属＝VFS、表面＝主题同源 token 层、内容纪律以 Apple HIG Widgets 为参照系、摆放与尺寸共用「整数网格 + 离散档」模型；实现偏差与挂账的逐条口径见该功能设计 §8「实现偏差」

**开放问题（D10 相关）**

- ~~v1 的摆放是右锚定自动流式（无拖拽）~~ **已解（2026-10-07）**：拖拽与换档按功能设计 §4.7 落地——`pos` 落 `{col,row}` 整数格、重叠拒绝回弹（L-3）、视口变窄越界退回流式并给成因（L-7）、手动态排序置灰（L-9）、件内可交互控件起手不启动拖拽（L-10）；像素级自由摆放/任意 span 仍在「不做」清单（D15）
- `WidgetFrame` 卡片根仍挂 `cq-widget` 但未定义任何容器查询变体：改尺寸 **不依赖**它（尺寸档由宿主经 context 给出，见功能设计 §4.7 末段），它纯粹是为「将来像素级自由缩放」预留的钩子——去留单独决定，别把它当成 resize 的前置
- **§4.8 合一视图残项（2026-10-07 核对，2026-10-06 收敛）**：主体已接线（搜索/灰态行/预览懒挂载与并发上限/tint 添加钮/排序把手/孤儿数据段/`WidgetConfigPanel` 两类宿主共用）。原两处残项消了一处——`openWidgetGallery(instanceId)` 现在有了传真 id 的调用方（溢出清单每行「在管理台定位」，`tests/e2e/widget-overflow.spec.ts` 钉住；卡片菜单「配置…」仍走宿主弹层不经抽屉，是功能设计 §8 偏差第 6 条的既定口径）；还剩生成器在 `description` 未给答案时仍产出 TODO 模板句（K1 残留，靠 author 手工清零）
- **既有缺陷（非本次引入，本次首次暴露）**：`OsButton` 的 `danger` 变体用 `text-danger`（语义 seed，rose-500）作文字色，落在可解析的实底面上仅 3.67:1（AA 需 4.5:1）；小组件库的移除按钮改走「ghost 按钮 + `text-danger-text` 图标」绕开，根因修复（`danger` 变体改用 `--color-danger-text`）会改动组件视觉基线，留作独立工作线
- **启用/卸载只到 kind 级**：停用一个种类会隐藏它所有实例；若将来要「只停用某一个实例」，正确落点是**实例级 `hidden`**（不是实例级 enabled）——原先附带的「要先有『同 kind 多实例』的真实场景」这个前提**已于 2026-10-06 作废**：没有任何 kind 声明 `singleton`，`widgets.add()` 默认走 `uniqueId(kindId, …)`，同 kind 多实例是用户当下就能走到的路径（数据隔离与「删件不删数据」已有腿，见功能设计 §8 偏差 27），剩下的只是产品拍板 `hidden` 的 UI 落点。现在仍不做，避免为一个未定需求先把模型复杂化（见功能设计 §8「继续挂账」、规划 §8）
