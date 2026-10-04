# WebOS 脚手架迭代路线

> 定位：在《WebOS前端架构设计.md》（形态与机制）与《WebOS设计规范与工程基建.md》（门禁与 token）之上，规划**企业级前端脚手架**方向的后续迭代。载体保持 WebOS 桌面形态。
>
> 本文只规划、不实施。每阶段开工前先在此细化设计点，实施中的偏差与状态回写第 8 节。

## 1. 路线定位

「脚手架」要回答的不是「还能加什么功能」，而是：**一个新应用如何以最低成本长在这套底座上，并天生具备权限、数据、组件、主题、i18n、发布这些企业级能力**。对标 ant design pro（access 权限模型 + ProTable/ProForm + 布局约定）与 element plus（组件契约 + 文档站）。

三条衡量口径，每阶段验收都回到这三条：

| 口径     | 含义                                     | 目标                             |
| -------- | ---------------------------------------- | -------------------------------- |
| 接入成本 | 新增一个应用要改多少文件                 | 1 个应用目录，0 处壳层/入口改动  |
| 一致性   | 视觉与交互是否只由 token + `src/ui` 派生 | 业务侧不出现复制样式与散落色值   |
| 可回归   | 改动是否被单测 / E2E / CI 兜住           | 新增能力必带测试，门禁全绿才提交 |

## 2. 现状与缺口盘点（截至 2026-10-04）

| 能力       | 现状                                                      | 缺口                                                         | 阶段 |
| ---------- | --------------------------------------------------------- | ------------------------------------------------------------ | ---- |
| 应用注册   | `main.ts` 逐个 `import` manifest 后 `registry.register()` | 无自动收集、无生成器、无应用开发指南                         | S1   |
| 权限       | 无。所有应用对所有「用户」可见                            | 无 manifest 权限字段、无会话/角色、`os.exec` 不鉴权          | S2   |
| 设置       | 仅右键菜单换壁纸；`theme` store 只有 `wallpaper`          | 无 settings 应用（架构文档目录里列了但未实现）               | S2   |
| 基础组件   | `src/ui` 五个：Button/Input/Dialog/TrafficLights/Badge    | 无表格、表单、选择器、抽屉、吐司、空态、骨架、页签、提示     | S3   |
| 加载态     | `KeepAlive :max="8"` 已落地                               | 无 Suspense fallback，懒加载期窗口内容空白（设计要求骨架屏） | S3   |
| 数据访问   | 应用直接消费 `vfs` store                                  | 无统一 query 契约（分页/排序/筛选）、无数据源抽象            | S4   |
| 主题       | token 已集中在 `styles/tokens.css`                        | 单套值，无暗色/强调色切换；`theme-v1` 无版本迁移             | S5   |
| 国际化     | 全仓中文硬编码（含 manifest.name）                        | 无 i18n 层                                                   | S5   |
| 文档与发布 | 三份设计文档在 `docs/`；无版本号演进                      | 无文档站、无 CHANGELOG、无包体预算、CI 未实跑（无远端）      | S6   |
| 可观测     | 失败仅 `console.warn` + 通知中心一次性提示                | 无全局错误边界、无日志回看                                   | S6   |

## 3. 迭代阶段

### S1 应用接入契约与生成器（规模 M）

**目标**：兑现「加一个应用只改一处」，把接入过程变成命令。

**交付物**

- `AppManifest` 契约扩展：`version`、`category`、`permissions?`（S2 消费）、`nameKey?`（S5 消费）；字段全部类型安全，新增字段可选以免破坏现有 4 个应用
- 自动注册：`main.ts` 的手工 import 换成 `import.meta.glob('./apps/*/manifest.ts', { eager: true })` 收集；注册顺序由 `manifest.order` 决定（Dock 与应用中心的排序不再依赖 import 顺序）
- `scripts/gen-app.mjs` + `npm run gen:app`：交互式（或参数式）产出 `src/apps/<id>/{manifest.ts,App.vue}` 骨架，自带 token 化样式与 `useOS()` 示例；不引入 plop 等额外依赖
- `docs/WebOS应用开发指南.md`：manifest 字段表、窗口/单例语义、CommandBus 与 VFS 用法、禁止事项（apps 之间不互相 import、不散落色值）

**验收标准**

- 用 `gen:app` 生成一个 hello 应用后，不改壳层与 `main.ts`，Dock / 应用中心 / Spotlight 三处自动出现它
- 删除该目录后三处自动消失（无残留注册）
- 现有 4 个应用行为不回归（E2E 冒烟 6 条全绿）；生成器产物本身通过 lint + type-check

**依赖**：无（可直接开工）

### S2 权限模型与 settings 应用（规模 M）

**目标**：企业级底座与 demo 的分水岭——能力可见性与可执行性由权限派生，且权限本身可在界面里切换查看。

**关键设计点**

- 会话模型：`kernel/stores/session.ts` 持当前用户 + 角色集合（纯前端，角色数据来自本地 fixture，不做登录协议）
- 鉴权落点单一：`useOS().can(appId)` 为唯一判定入口；`wm.open` 与 `os.exec` 前置校验，未授权**不抛异常**——返回 false + 通知中心留痕，与既有「未注册命令」处理同构
- 派生收口：应用中心、Dock、Spotlight 一律消费 `registry.accessibleApps` getter，不允许各自过滤
- 出口：未授权提示必须给可操作出口（跳 settings 切换角色），不做「等待确认」的死态
- settings 应用：用户/角色切换、主题（S5 扩展）、Dock 固定项、窗口布局重置、系统信息；设置项持久化沿用 `kernel/fs/idb` kv

**交付物**：`session` store、`can/accessibleApps`、settings 应用、权限相关单测与 1~2 条 E2E（切角色 → 应用中心结果变化）

**验收标准**

- 切换角色后，Dock / 应用中心 / Spotlight 三处可见应用同步变化；直接 `os.exec('<受限应用>:open')` 被拒并在通知中心留痕
- 刷新后角色与设置还原
- 无权限的应用不出现在任何派生入口（单测覆盖 getter）

**依赖**：S1（manifest 的 `permissions` 字段）

### S3 组件纵深：表格 / 表单 / 反馈（规模 L）

**目标**：把 `src/ui` 从「五个基础件」扩到能拼出企业管理台页面的组件集，且展示方式本身符合 WebOS 形态。

**交付物**

- 数据录入：`OsSelect`、`OsCheckbox`、`OsSwitch`、`OsRadio`、`OsForm`（schema 驱动 + 校验 + 横/纵/内联三种布局）
- 数据展示：`OsTable`（列 schema、排序、行选择、分页插槽、内建 loading/empty）、`OsPagination`、`OsTabs`、`OsBadge`（已有）、`OsTooltip`
- 反馈：`OsDrawer`、`OsToast`（走 notification store，不另起一套）、`OsEmpty`、`OsSkeleton`
- 懒加载骨架屏：`WindowFrame` 内容区补 `Suspense` + `OsSkeleton`，兑现架构文档 5.2 的设计
- **组件陈列应用**（`apps/component-gallery`）：所有 `src/ui` 组件的可交互示例，替代 Storybook——文档站在 S6，但组件从 S3 起就有可视可点的验收场所

**硬约束**

- schema 优先，但每个 schema 字段都要有插槽逃生口（开闭原则：新场景加 variant/插槽，不在业务侧复制样式）
- 只消费 token 派生类；新增视觉值先进 `tokens.css`
- 每个组件必须有 props/emit 契约单测（沿用 `tests/unit/ui.test.ts` 模式，按组件拆文件）
- 现有 file-manager 的自建表格/表单改写为消费新组件（否则组件等于没被验证）

**验收标准**

- component-gallery 内每个组件可交互操作，视觉与壳层一致（computed style 抽查断言）
- file-manager 全量改用 `OsTable`/`OsForm`/`OsDialog`，功能不回归
- 窗口懒加载期显示骨架屏而非空白
- 单测数量与覆盖率较 S2 提升，门禁全绿

**依赖**：S1（应用生成器，gallery 用它产出）；与 S2 无强依赖，可并行

### S4 数据访问层与三态规范（规模 M）

**目标**：应用不再直接摸 store，读写经统一契约；将来接后端只换实现。

**关键设计点**

- `kernel/data/types.ts`：`Query = { page, pageSize, sort?, filter?, keyword? }`、`Page<T> = { rows, total }`、`DataSource<T> = { query(q), create, update, remove }`
- 两个实现：`vfsDataSource`（包现有 VFS store）与 `fixtureDataSource`（本地 JSON 种子数据，**不起 mock server**）；RemoteFS 只留接口不实现（沿用架构非目标）
- 三态规范：loading / empty / error 由组件内建（S3 的 `OsTable`/`OsEmpty`/`OsSkeleton`），业务侧不再各写一套
- 变更语义：乐观更新 + 失败回滚；错误统一 `console.warn` + 通知中心，不打断调用方（与既有 `vfs:changed` 一致）
- 示例应用：`apps/data-board`——用 `OsTable` + `fixtureDataSource` 展示分页/排序/筛选/三态，作为脚手架的「参考页面」

**验收标准**

- data-board 在 fixture 数据源上跑通分页、排序、筛选、增删改与三态；断网/异常路径有 error 态且可重试
- file-manager 改为消费 `vfsDataSource`，行为不回归
- `DataSource` 契约有单测（两个实现共用同一套契约测试）

**依赖**：S3（表格/三态组件）

### S5 主题纵深与国际化（规模 M）

**目标**：token 体系从「一套值」升级为「可切换的多套值」，文案从硬编码升级为可翻译。

**关键设计点**

- token 分层：`tokens.css` 只留语义变量（`--color-glass-*`、`--color-ink-*`…），原始值拆到 `theme-light.css` / `theme-dark.css`，由 `:root[data-theme='dark']` 覆盖
- 暗色下的玻璃材质需重新取值（白高透明在深底上会发灰），先出对照截图再定值，不靠猜
- `theme` store 扩为 `{ wallpaper, mode, accent }`；`theme-v1` 加版本号与迁移函数（旧数据只有 wallpaper 时可读）
- i18n：vue-i18n，内置 zh-CN / en-US；`manifest.name` → `nameKey` 回退兼容；壳层与 `src/ui` 文案先全量接入，应用文案按应用推进
- 密度切换（compact/normal）标为**可选**：影响面大（间距全量走变量），先看 S3/S4 落地后的实际收益再决定

**验收标准**

- 明暗切换全局生效且刷新后保持；暗色下顶栏/Dock/窗口/弹层对比度经截图复核（无发灰、无不可读文本）
- 语言切换后壳层、settings、component-gallery 文案全变；未翻译项回退中文而非显示 key
- token 消费规则不回退：源码无新增散落色值（lint + grep 双查）

**依赖**：token 体系（已就位）；建议在 S3 之后做，避免组件铺开期反复改样式

### S6 文档站、版本与可观测（规模 M）

**目标**：让这套脚手架能被别人用起来、能被追溯、出问题能查。

**交付物**

- VitePress 文档站：应用开发指南、组件 API（从 S3 的契约单测与 gallery 提炼）、token 清单、架构与规范文档镜像；`npm run docs:dev` / `docs:build`
- 版本与变更：changesets 语义化版本 + CHANGELOG；`package.json` 版本随阶段推进
- 构建：`manualChunks` 分 vendor / vue / apps 三类；CI 加包体预算（超阈值失败）；核查每个应用 entry 都是独立 chunk
- 可观测：`app.config.errorHandler` + 窗口级错误边界（应用崩溃不拖垮壳层，窗口内显示错误态并可重载）；错误日志环形缓冲落 IndexedDB，**在 settings 应用内可回看**（失败可查，不只看 console）
- CI 补强：首次 push 验证 Actions 实跑；单测覆盖率阈值；E2E 产物（trace/screenshot）上传

**验收标准**

- 文档站本地可构建、内容与源码一致（组件 API 对得上 props）
- 手动在某个应用里抛错：壳层存活、该窗口显示错误态、settings 日志里能看到这条记录
- CI 在远端实跑通过一次；包体预算生效
- 构建产物按应用分包，首屏不加载未打开的应用

**依赖**：S3（组件 API 稳定）、S2（settings 应用承载日志回看）

## 4. 顺序与依赖

```text
S1 接入契约 ──┬─→ S2 权限 + settings ──┐
              └─→ S3 组件纵深 ──→ S4 数据层 ──→ S6 文档站/版本/可观测
                       └──────→ S5 主题 + i18n ──┘
```

- 建议节奏：S1 → S2 → S3 → S4 → S5 → S6；S3 与 S2 可并行（不同工作线，分开提交）
- 每阶段是一条独立工作线：单独提交、单独验收、单独回写文档，不跨阶段混提交
- 每阶段开工前先在本文件把该阶段的「关键设计点」细化到文件级，再动代码

## 5. 贯穿性约束（每阶段都适用）

1. **纯前端**：不建后端、不起 mock server；「接真数据」= VFS store CRUD + IndexedDB + 本地 fixture
2. **docs-first**：先改文档再改代码，实施偏差回写文档
3. **token 硬约束**：禁止散落色值与魔法时长；例外仅限中性面与 per-app 品牌色（见规范文档 3.1）
4. **组件收口**：相似能力参数化收敛到一处基础组件，不在业务侧复制样式
5. **测试**：新增逻辑必带单测，新增链路必带 E2E；提交前 husky 门禁（lint-staged + type-check）必须通过
6. **实测**：UI 改动必须浏览器实测（含面板隐藏、窗口最小化等已知陷阱），并如实说明未点测部分
7. **提交粒度**：一个 commit 一条工作线，逐文件名 `git add`，中文单行「类型：描述」

## 6. 范围外（明确不做）

- 后端服务、登录协议、多端同步（RemoteFS 只留适配器接口）
- 微前端 / iframe 隔离（评估触发点见架构文档「开放问题」：应用数 > 15）
- 移动端适配（WebOS 桌面形态，窄屏仅保持现有降级：Widgets 隐藏）
- 视觉回归基线（暂不引入，改视觉以截图人工复核 + computed style 断言代替）
- 工作流设计器等重业务应用（属业务线，不属脚手架线）

## 7. 开放问题

| 问题                                   | 评估时点      | 倾向                                                    |
| -------------------------------------- | ------------- | ------------------------------------------------------- |
| 图表能力是否引 echarts                 | S4 data-board | 先不做；若参考页面确有需要，作为独立依赖决策单独评估    |
| 文档站选 VitePress 还是 Storybook      | S6 开工前     | VitePress（与三份设计文档同源，Storybook 另起一套体系） |
| 密度切换是否值得做                     | S5 收尾       | 可选；先看 S3/S4 后组件铺开的实际收益                   |
| 权限模型粒度（角色 vs 权限点 vs 两者） | S2 开工前     | 权限点为主、角色为集合；避免过早起 RBAC 抽象            |
| 是否给 `src/ui` 出独立包（monorepo）   | 应用数 > 15   | 暂不；当前单仓 + 目录边界足够                           |

## 8. 实施状态

| 阶段 | 状态   | 说明                                                                                 |
| ---- | ------ | ------------------------------------------------------------------------------------ |
| S1   | 已完成 | manifest 扩展 + glob 自动注册 + `gen:app` 生成器 + 应用开发指南；4 单测 + 6 E2E 全绿 |
| S2   | 未开始 |                                                                                      |
| S3   | 未开始 |                                                                                      |
| S4   | 未开始 |                                                                                      |
| S5   | 未开始 |                                                                                      |
| S6   | 未开始 |                                                                                      |

**实施期对路线的修正（回写此处）**

- S1：`register()` 内部按 `order` 升序稳定插入（缺省 100），排序不依赖 glob/import 顺序，无需额外 `sortedApps` getter；`dockApps`/`app-center`/`spotlight` 直接消费 `apps` 即已有序。生成器为纯 Node（`readline/promises`），无新依赖；eslint 为 `scripts/**/*.mjs` 增加 Node 全局与 `no-console: off` 覆盖。
