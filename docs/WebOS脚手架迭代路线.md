# WebOS 脚手架迭代路线

> 定位：在《WebOS前端架构设计.md》（形态与机制）与《WebOS设计规范与工程基建.md》（门禁与 token）之上，规划**企业级前端脚手架**方向的后续迭代。载体保持 WebOS 桌面形态。
>
> 本文只规划、不实施。每阶段开工前先在此细化设计点，实施中的偏差与状态回写第 8 节。
>
> S1~S6 已全部完成（见第 8 节）。后续缺口以 Ant Design 体系为参照另文规划，编号续于 S7~S12，见《WebOS对标AntDesign迭代规划.md》。

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

| 阶段 | 状态   | 说明                                                                                                                                                                                                                                                                                                                                             |
| ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1   | 已完成 | manifest 扩展 + glob 自动注册 + `gen:app` 生成器 + 应用开发指南；4 单测 + 6 E2E 全绿                                                                                                                                                                                                                                                             |
| S2   | 已完成 | session 权限模型（权限点为主/角色为集合）+ `can`/`accessibleApps` 收口 + `wm.open` 鉴权留痕 + settings 应用；7 单测 + 2 E2E 全绿                                                                                                                                                                                                                 |
| S3   | 已完成 | 13 个 `src/ui` 组件（表格/表单/反馈/录入/展示）+ WindowFrame Suspense 骨架屏 + component-gallery + file-manager 改用 OsTable/OsForm；23 单测 + 2 E2E 全绿                                                                                                                                                                                        |
| S4   | 已完成 | `kernel/data`（Query/Page/DataSource 契约 + `applyQuery` 纯函数）+ fixture/vfs 两实现（RemoteFS 只留接口）+ OsTable 内建 error 三态 + data-board 参考页 + file-manager 改走 vfsDataSource；15 单测 + 2 E2E 全绿                                                                                                                                  |
| S5   | 已完成 | token 分层（`tokens.css` 语义层 + `theme-light/dark.css` 原始值 + accent 预设）+ `theme` store `{wallpaper,mode,accent}` 带版本迁移 + vue-i18n（zh-CN/en-US，`manifest.nameKey` 回退）+ 壳层/`src/ui`/settings/component-gallery 全量接入；11 单测 + 3 E2E 全绿                                                                                  |
| S6   | 已完成 | VitePress 文档站（应用开发/组件 API/token/架构镜像，`docs:build` 通过）+ changesets 版本与 CHANGELOG（`0.1.0`）+ Vite `manualChunks`（vue/vendor/7 应用异步 chunk）与包体预算脚本 + 全局 `errorHandler`/窗口级错误边界/错误日志环形缓冲落 IndexedDB 并在 settings 回看 + CI 补强（覆盖率阈值/预算/docs:build/E2E 产物上传）；8 单测 + 1 E2E 全绿 |

**实施期对路线的修正（回写此处）**

- S1：`register()` 内部按 `order` 升序稳定插入（缺省 100），排序不依赖 glob/import 顺序，无需额外 `sortedApps` getter；`dockApps`/`app-center`/`spotlight` 直接消费 `apps` 即已有序。生成器为纯 Node（`readline/promises`），无新依赖；eslint 为 `scripts/**/*.mjs` 增加 Node 全局与 `no-console: off` 覆盖。
- S2：权限模型采「权限点为主、角色为集合」（开放问题倾向落地）——`manifest.permissions` 为权限点数组，空即公开；`ROLES`/`USERS` 为本地 fixture，`admin` 角色持通配 `*`。鉴权唯一判定 `session.canAccessApp(manifest)`，`useOS().can(appId)` 与 `registry.accessibleApps`/`dockApps` 均经它派生；`wm.open` 为单一落点（app-center/Dock 直调 `wm.open`，故 gate 放此处最稳），未授权返回 `null` + 通知中心留痕，通知带 `action`（去设置切换角色）作为可操作出口，不做等待确认死态。`dockApps` 叠加 `settings.dockPinned` 覆盖表（用户固定/取消，缺省沿用 `manifest.dock`）。默认用户 `admin` 保证既有 E2E 不回归。
- S3：组件测试按品类分组落文件（`ui-inputs`/`ui-table`/`ui-form`/`ui-feedback`）而非文档暗示的「一组件一测试文件」，避免碎文件。`OsBadge` 只渲染计数胶囊、无默认插槽，故陈列与角色标签均以内联 `<span>` 包裹或改用普通样式 span，不套 `OsBadge`。`OsForm` 必填星号用 `<span class="text-danger">*</span>` 而非 `after:content-['*']`（转义引号 Tailwind 源码扫描不识别）。`OsTable` 为泛型组件（`generic="T"`），`defineModel` 托管 `selected`/`page`，`remote` prop 关闭本地排序交由父级，内置 `OsSkeleton`/`OsEmpty` 与分页页脚，file-manager 的行图标在 `toRow()` 里预计算（`icon`/`iconCls`）以规避模板内 `as never` 断言。`WindowFrame` 内容区以 `Suspense + KeepAlive(:max=8)` 包裹，fallback 出骨架屏。
- S4：分页/排序/关键字/过滤语义抽到 `kernel/data/types.ts` 的纯函数 `applyQuery`，fixture 与 vfs 两实现共用，契约单测用同一套断言跑两遍（`runContract`）保证行为一致。`DataSource` 变更方法在失败时 **reject**（供调用方回滚乐观更新），错误由 `kernel/data/errors.ts` 的 `reportError` 集中 `console.warn` + 通知中心留痕（无活动 pinia 时静默降级，不反噬业务），即「不打断调用方」= 不同步抛异常、不吞掉 reject。三态补齐：`OsTable` 新增 `error` prop + `@retry`（error 优先级高于 loading/empty，内建 `OsEmpty` + 重试按钮），loading/empty 沿用 S3。`vfsDataSource` 的 `query.filter` 约定 `{dir,trash}` 为寻址参数、非 `FsNode` 字段，须在 `applyQuery` 前剔除否则会按不存在字段过滤掉全部行；`update` 重命名的目标路径要在 `rename` **前**用 `uniquePath` 算出（rename 会移动子树，事后再算将命中已存在目标而误加序号）。file-manager 改为 `ds.query` 异步读取 + 订阅 `vfs:changed` 重载，回收站「还原」为 VFS 专有动作、不在通用 CRUD 契约内，仍直走 store。data-board 用「模拟异常」开关驱动 `failWhen`，无需断网即可演示 error 三态、可重试与乐观回滚。RemoteFS 仅留 `kernel/data/remote.ts` 接口（`extends DataSource` + `baseUrl`），不起 mock server。
- S5：token 采「语义层 + 原始值」两层——`tokens.css` 的 `@theme --color-*` 一律引用 `--raw-*`，`theme-light.css`/`theme-dark.css` 只定义 `--raw-*`，暗色切换仅换原始值、零工具类/组件改动；`theme-dark.css` 在 `theme-light.css` **之后**引入，使 `:root[data-theme='dark']`（与 accent 预设同 0,2,0 特异度）靠源码顺序压过 `:root[data-accent='*']`，暗色强调色由 `color-mix(in oklab, var(--raw-accent) N%, …)` 派生 `accent-strong/soft`。`theme-v1` 加 `THEME_VERSION=2` 与迁移（旧数据仅 wallpaper 可读，mode/accent 回落默认）。i18n 用 vue-i18n 组合式（`legacy:false`），组件内 `useI18n()`、非组件处 `i18n.global`，`fallbackLocale:'zh-CN'` 保证未翻译项回退中文而非显示 key；`manifest.name` 保留、新增 `nameKey`，`useAppName()` 统一解析（Dock/Spotlight/app-center/窗口标题本地化名）。**修正一处持久化 bug**：`settings.persist()` 直接把响应式 `dockPinned`（Vue Proxy）交给 `idbSet` 触发 `DataCloneError`（结构化克隆无法克隆 Proxy）致语言偏好写不进 IndexedDB、刷新丢失；改为 `toRaw(this.dockPinned)`（对齐 `vfs` store 既有写法）。**范围收敛**：应用「内容」文案（data-board/file-manager 表格数据等）未纳入 S5——验收只覆盖壳层/settings/component-gallery，本地化它们会破坏既有 S4 E2E 断言且超范围；应用「名称」仍经 `nameKey` 本地化。密度切换按路线标为可选、本阶段不做。暗色对比经浏览器实测（`.text-ink`→`#e2e8f0` 落 `--raw-surface:#1e293b`，品牌白字），非截图但已核验计算色值。
- S6：可观测按「三层落点 + 环形缓冲」收口——`main.ts` 装 `app.config.errorHandler` 与 `window.error`/`unhandledrejection`（scope `global`）、`ErrorBoundary.vue` 以 `onErrorCaptured` 返回 `false` 拦在窗口内（scope `window`，避免冒泡到全局二次记录）、`kernel/data/errors.ts` 的 `reportError` 追加 `data` 域留痕；日志经 `useErrorLog` store 环形缓冲（上限 50，`errorlog-v1` 落 IndexedDB，写入前 `toRaw(...).map(e=>({...e}))` 规避 Proxy 克隆失败），settings「诊断日志」段可回看与清空——兑现「失败可查，不只看 console」。`ErrorBoundary` 包在 `Suspense` **外层**，使 `KeepAlive` 直接托管应用组件、错误态不破坏最小化/还原的状态保持；component-gallery 加 `CrashProbe`（渲染期主动抛错）作为可点的验收现场。**构建分包**：`manualChunks(id)` 把 `@vue`/`pinia`/`vue-i18n`/`@intlify` 归 `vue`、其余 `node_modules` 归 `vendor`，应用组件经 `defineAsyncComponent` 动态 import 各自成 chunk（实测 7 个 `App-*.js`），首屏不加载未打开的应用；`scripts/check-bundle.mjs` 校首屏总量（≤700KB）与单 chunk（≤260KB）超限即 `exit 1`，接进 `build:check` 与 CI。**版本**：`__APP_VERSION__` 由 `vite.config.ts` 从 `package.json` 注入（`define`），settings 版本号不再硬编码；changesets 语义化版本 + CHANGELOG。**文档站**：VitePress（开放问题倾向落地，与三份设计文档同源），`website/` 下应用开发/组件 API/token/架构镜像，`docs:build` 默认对死链失败故链接改本地路径。**CI 补强**：`test:unit` 换 `test:unit:coverage`（v8 provider，`include` kernel/i18n/windows，阈值 lines/functions 60、branches 50、statements 60，当前全量 66/56/69/69 通过）、加 `build:check`、`docs:build`、`if: failure()` 上传 `playwright-report`。**ESLint 忽略**补 `website/.vitepress/{dist,cache}`（否则 VitePress 构建产物被 lint 报 890 错）。**未决**：验收「CI 在远端实跑通过一次」需 `git push` 触发 Actions，属影响远端的操作，未自主执行——待用户确认后 push 并回看 Actions 结果再勾这条。
