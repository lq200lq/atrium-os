# WebOS 前端架构设计

> 依据产品概念图（万物皆应用 WebOS 桌面）制定的前端架构设计文档，作为后续脚手架与迭代的唯一设计依据。

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
│ TopBar  Dock  Desktop(壁纸/图标/右键菜单)  Widgets  通知中心  Spotlight │
├─ Kernel（OS 服务层：Pinia stores + composables）──────────┤
│ WindowManager  AppRegistry  CommandBus  VFS  Theme  Persistence   │
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
- 实施形态：统一走 `kernel/fs/idb` 的 kv store——`layout-v1` 存窗口快照（appId/title/rect/z/status/prevRect/payload，`toRaw` 后写入），`theme-v1` 存壁纸，`fs-v1` 存 VFS；windowManager 经 `$subscribe` 防抖 400ms 落盘，启动时在 `mount` 前 `restoreLayout()` 重建窗口（新 id、保留 z 序与最小化态）；恢复的窗口不触发入场动画（TransitionGroup 未开 `appear`）

## 6. 目录结构

```
src/
├─ shell/                  # 外壳层
│  ├─ TopBar/              #   全局菜单、搜索入口、状态区、时钟
│  ├─ Dock/
│  ├─ Desktop/             #   壁纸、桌面图标、右键菜单
│  ├─ Widgets/             #   时钟、日历、今日事项
│  ├─ NotificationCenter/
│  └─ Spotlight/           #   全局搜索面板
├─ kernel/
│  ├─ stores/              #   windowManager.ts appRegistry.ts webApps.ts vfs.ts theme.ts notification.ts
│  ├─ bus/                 #   commandBus.ts
│  ├─ webapp/              #   url.ts：外部网页应用的地址校验归一（安全边界，纯函数）
│  └─ composables/         #   useOS.ts useWindowDrag.ts useWindowResize.ts
├─ windows/
│  ├─ WindowFrame.vue      #   标题栏、交通灯、边框、缩放把手
│  ├─ EmbedView.vue        #   外部网页应用内容区（唯一 iframe 落点，D2′）
│  └─ WindowManager.vue    #   遍历渲染 + KeepAlive + Suspense
├─ apps/
│  ├─ ai-assistant/        #   每应用：manifest.ts + App.vue + 内部组件
│  ├─ doc-editor/
│  ├─ workflow-designer/
│  ├─ docs-center/         #   内置 embed 应用样板：manifest 只声明 embed.url，无 App.vue
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

| 编号 | 决策          | 结论与理由                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1   | 应用隔离方式  | **同仓组件 + manifest 懒加载**。通信直接、样式统一、可做毛玻璃与统一动画；微前端（wujie/module-federation）留作将来应用需独立部署时的演进方向                                                                                                                                                                                                                                                                                                                                                           |
| D2′  | 窗口内容渲染  | **默认纯 DOM；iframe 只允许作为「外部网页应用」的内容区实现**（收窄自原 D2「纯 DOM，不用 iframe」）。半透明材质、统一窗口动画、标题栏与错误边界都依赖同文档渲染，因此**壳层与自研应用永远走 DOM**；需要承载用户提供的第三方站点时，唯一可行手段是 iframe，故把它限定在 `AppManifest.embed` 声明的类目里，由 `src/windows/EmbedView.vue` 一处实现，不参与壳层材质与动画。**代价（明确接受）**：frame 内文档不被我们的主题/动效/ErrorBoundary/i18n 覆盖，跨源内容读不到（标题、历史、滚动位置都不能回读） |
| D3   | z 序管理      | 单调递增计数器（focus 时 `z = ++topZ`），避免数组重排与全量重渲染                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D4   | 单例/多实例   | 由 manifest `singleton` 声明；多实例以 `appId + payload.key` 去重复用                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| D5   | 拖拽/缩放性能 | 跟手阶段走 transform，pointerup 回写 store，避免 pointermove 高频触发全树响应式更新                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D6   | Dock 点击语义 | 聚焦中→最小化；存在最小化→还原；否则新开（P0 实测补）                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| D7   | 组件入 store  | `markRaw` 包裹异步组件，禁止组件对象被响应式化                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| D8   | 持久化与挂载  | VFS 落库前 `toRaw`；IDB 不可用降级内存模式，挂载不被持久化 gate                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D9   | 统一图标出口  | 不用 emoji；lucide-vue-next 经 `OsIcon` + `ICON_MAP` 收口渲染，`manifest.icon` 为类型安全图标名，文件类型图标（含配色）由共享 `fileIconName/fileIconClass` 派生                                                                                                                                                                                                                                                                                                                                         |

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
| 工程基建打底         | 已完成（2026-10-04） | 详见《WebOS设计规范与工程基建.md》：ESLint/Prettier/husky 门禁、Vitest 单测（45 例）、Playwright E2E 冒烟（6 例，均为打底时点读数，现状见《WebOS对标AntDesign迭代规划.md》§9）、GitHub Actions CI、设计 token 化（`src/styles/tokens.css`）、`src/ui/` 基础组件收口                                                                                         |
| 后续迭代路线         | 已规划（2026-10-04） | P0~P3 与打底完成后的脚手架方向路线（S1 应用接入契约与生成器 / S2 权限模型与 settings / S3 组件纵深 / S4 数据访问层 / S5 主题与 i18n / S6 文档站·版本·可观测）详见《WebOS脚手架迭代路线.md》，该文档为后续迭代的设计依据                                                                                                                                     |
| 对标 Ant Design 纵深 | 进行中（2026-10-05） | S1~S6 之后以 Ant Design 的设计/研发/组件体系为参照另文规划 S7~S12（设计语言成文与 token 刻度、组件契约、布局与展示件、反馈与导航件、配置层与文档自动化、a11y 与质量线），详见《WebOS对标AntDesign迭代规划.md》；S7~S11 已完成，逐阶段状态见该文档 §9                                                                                                        |

| 外部网页应用类目 | 已完成（2026-10-05） | D2′ 落地：`AppManifest` 加 `embed` 与 `entry` 二选一（`register()` 合成内置 `EmbedView`，渲染路径仍一条），新增 `webApps` store（`webapps-v1`）持久化用户在应用中心「网页应用」分区添加的外部站点，内置 `docs-center` 以 `embed: { url: '/docs/index.html' }` 指向同源文档站（`docs:embed` 把 VitePress 产物复制进 `public/docs/`；同源入口必须带扩展名，故壳层加了「被嵌入即拒绝挂载」的反嵌套判断）；跨源拒绝嵌入不做伪检测，走超时告警 + 新标签页出口（两类结局均已浏览器实测：同源 fixture 与文档站正文可读；`https://www.google.com` 因 `x-frame-options: SAMEORIGIN` 拿到 200 + 触发 `load` 却画面空白，界面如实停在就绪态、工具栏「重试 / 新标签页打开」始终可用，卸载后刷新不复活）。**门禁实测**：单测 60 文件 / 479 例（新增 `webapp-url` 21 + `webApps` 10 + `embed-view` 9 + `web-apps-panel` 5 + 双语 key 齐平 1），E2E 84 条全绿（77→84：`web-app.spec.ts` 6 条走「添加 → Dock 磁贴 → `frameLocator` 读到同源正文 → 刷新仍在 → 卸载连带关窗且刷新不复活 → `javascript:` 被字段错误拦下 → 内置文档中心渲染同源文档站首页 → 访客角色不收窄 embed 类目」，另 1 条为 a11y 的网页应用三场景扫描），首屏 235.5KB（预算 700KB）、最大单块 `vue` 147.7KB（预算 260KB）、`EmbedView` 独立异步块 2.8KB，图标白名单 28 个覆盖 24 个用点，42 张 API 表 `docs:check` 一致。**反证（证明门禁不是摆设，跑完即撤）**：manifest 里把图标写成 `nope` → `gen-icons --check` exit=1；`entry`+`embed` 同时给出由 `@ts-expect-error` 用例锁住（指令一旦失效 vue-tsc 即报错）；语言包删一条 en key → 双语齐平用例如期报出 `webApp.add`；面板里把拒绝原因路径写回错的 `webApp.reason.tooLong` → 组件用例报出「显示成 key 而不是文案」；把 `webApps.toManifest()` 的 `permissions` 从 `[]` 改成 `['fs:read']` → 访客角色用例如期报出新磁贴消失（哨兵不是摆设：它先证明角色真变了，再证明公开类目没被顺手收窄）。**2026-10-06 做实（D2′ 同一条决策链的补充）**：口径从「同源入口必须带扩展名」放宽为**三层运行链**（① 带扩展名的真文件地址 ② `vite.config.ts` 内联插件 `serve-embedded-docs` 按存在性重写 dev/preview 两侧的目录根与无扩展名深链 ③ 都没兜住的落 `main.ts` 反嵌套守卫），`predev` 挂 `embed-docs --if-missing` 使全新克隆首开即有文档站正文（并顺带自愈没挂 `pretest:e2e` 的 a11y/visual 两个 job）；文档站开出本地搜索（`search.provider='local'` + `options.translations` 中文文案）与根级 `lastUpdated`，补 `/tokens`·`/architecture` 参考侧栏；⌘K 与 `/` 的归属写进指南（frame 内焦点归文档站内搜索，**不**由父层接管快捷键）。**本轮门禁实测**：`tests/e2e/docs-deep-link.spec.ts` 6 条（首开 `.VPHome` 在场 + 内链三形态盘点 + 搜索触发件装配 + `/docs/`、`/docs/components/`、`/docs/tokens` 三条硬导航各锁 `html[data-webos-guard]` 计数 0），dev 与 preview 两侧 curl 矩阵确认三种形态都落真页面；`docs:embed` 1.6s，搜索新增 `@localSearchIndexroot` 与 `VPLocalSearchBox` 两个**懒加载** chunk ≈201KB 全落 `dist/docs`（`check-bundle.mjs` 只扫 `dist/assets`），OS 首屏（纯检出实测 235.5KB）与最大单块 `vue` 147.7KB 均不回归；42 张 API 表 `docs:check` 一致。**反证（跑完即撤）**：摘掉中间件 → 三条硬导航红；摘掉 `search.provider` → frame 内触发件断言红；把 `en-US` 的 `apps.docEditor` 改回 `'Docs'`（与 `apps.docsCenter` 撞名）→ 本轮新增的「同一语言内 `apps.*` 取值不得重复」单测红并逐条报出撞名 key。口径修正：`website/index.md` 与 `website/architecture.md` 的组件数 18 → 41（`docs/WebOS对标AntDesign迭代规划.md` §3 的 18/31 属规划时点快照，不回改，只在注尾加指针）。 **守卫做实（同日 B 线）**：反嵌套判定从 `main.ts` 的启动链尾上移到新的 `src/entry.ts`（`index.html` 的模块脚本改指它），判定通过才 `void import('./main')`——被嵌入的那份文档连内核模块图都不求值。降级页按成因分两态（`docs-fallback` 处方 `npm run docs:embed` / `self-embed` 处方「同源入口要写成真实文件地址」），双语用并列 `<p lang>`（此刻 i18n 还没 boot），样式走 `main.css` 新增的 `.embed-guard*` + 既有 token，恒浅色（不启动 store 就拿不到 `theme-v1`，为一张说明页引入状态依赖不值）。上移的必要性是状态污染而非观感：旧形态里内层照样跑 `theme.restore/vfs.init/webApps.restore/wm.restoreLayout`，而 `wm.$subscribe → schedulePersist` 的 400ms 防抖会把内层刚恢复出的旧快照写回同一份 `layout-v1`。**这条断言的设计过程本身是一次实测修正**：原计划按「刷新后少一个窗口」断言，实测发现（a）全新上下文里 `layout-v1` 为空，内层 `restoreLayout` 原样早退、一次都不写，那样的绿是假的，故用例里先开一扇窗并等 700ms 落一次非空布局作前置；（b）内层与外层各持一个 400ms 防抖，谁后落盘取决于模块图加载耗时，dev 下外层几乎总是赢——于是断言换成「谁写的」：`page.addInitScript` 在每个文档里给 `IDBObjectStore.prototype.put` 记账，断言内层对 `layout-v1` 零写入（无条件不变量），`reload` 后窗口仍在只作可读性佐证。**本轮门禁实测**：`tests/unit/embed-guard.test.ts` 新增 8 例（成因判别含「`/docsx` 不算文档站」、两态处方互斥、挂载残留被清）；`docs-deep-link.spec.ts` 由 6 条增至 9 条（守卫两态各锁处方文案 + 一条「卡片有边框」的反裸文本断言 + 一条零副作用）。**反证 2**：把守卫挪回 `.then()` 链尾 → 零副作用条红（实测 `Received: 1`），跑完即撤。包体口径连带修正：入口拆出后 `main.ts` 成为独立 chunk，`check-bundle.mjs` 的首屏定义从 `index+vue+vendor` 改成 `index+main+vue+vendor`（`git worktree` 纯检出实测：入口 4.2 + 壳层 `main` 77.7 + `vue` 147.7 + `vendor` 8.3 = 237.9KB / 预算 700KB，比拆分前同一口径的 235.5KB 多 2.4KB（入口块本身与动态导入的包装），最大单块仍是 `vue` 147.7KB；先前写进文档的 243.5 / 249.6 / 89.3 出自共享工作区——那棵树同时带着另一条线未提交的壳层改动，`main` 块因此虚高 11.6KB，包体读数一律以干净检出为准），漏算 `main` 等于凭空少掉整个壳层；顶层首屏因此多一跳往返，代价写在 `src/entry.ts` 注释里。 |

**实施期对设计的修正（已回写本文档）**

- D6：Dock 点击语义 = 聚焦中最小化 / 有最小化还原 / 否则新开（`restore` action）
- D7：异步组件入 store 前 `markRaw`，避免组件对象被响应式化
- D8：VFS 落库前 `toRaw`；IDB 不可用降级内存模式，挂载不被持久化阻塞（5.4 已述）
- D2→D2′：需求「把外部站点当应用」推翻原「不用 iframe」；渲染改为单一入口 + `AppManifest.entry`/`embed` 二选一，iframe 只在 `EmbedView` 一处出现，壳层材质与动画不受影响（详见《WebOS应用开发指南.md》「外部网页应用」）
