# WebOS 对标 Ant Design 迭代规划（S7~S12）

> 定位：承接《WebOS脚手架迭代路线.md》（S1~S6，已全部完成），以 **Ant Design v6** 的设计语言、组件全集与研发工件为参照系，盘点本系统在**设计 / 组件 / 研发**三条线上的结构性缺口，规划 S7~S12。
>
> 本文只规划、不实施。每阶段开工前先把该阶段「关键设计点」细化到文件级，实施偏差与状态回写第 9 节。
>
> 参照基线取自离线资料（非记忆推断）：`antd design.md`（v6 默认亮色主题：四价值观 + 色彩/字体/布局/高度/形状规范 + Do's & Don'ts）、`antd list`（72 个组件，7 类）、`antd token`（234 个全局 token 名单）。

## 1. 本规划的判断口径

延续 S1~S6 的三条衡量口径（接入成本 / 一致性 / 可回归），本阶段新增第四条，因为组件铺开后会成为主要劣化源：

| 口径     | 含义                                           | 目标                                                               |
| -------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| 接入成本 | 新增应用要改多少文件                           | 维持：1 个应用目录，0 处壳层改动                                   |
| 一致性   | 视觉与交互是否只由 token + `src/ui` 派生       | **裸值清零**：间距/圆角/字号/高度/阴影/z 全部走 token              |
| 可回归   | 改动是否被单测 / E2E / CI 兜住                 | 新增能力必带测试，门禁全绿                                         |
| 可辨识   | 用户是否总能看清「在哪 / 刚做了什么 / 下一步」 | 每个组件都有显式 hover/focus/disabled/loading/error 态，且键盘可达 |

「可辨识」直接对应 antd 的四值之 **Certain（确定）**：本系统当前的短板不是不好看，而是**状态不明确**——`OsInput` 的契约里没有 `disabled`、三态只有 Table 有、焦点靠 7 处 `outline-none` 抹掉、禁用只有裸 `opacity-40`。

## 2. 参照基线：Ant Design 已成文而本系统未成文的部分

| antd 的做法                                                                                                       | 本系统现状                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 四价值观（Natural / Certain / Meaningful / Growing）作为设计决策的仲裁依据，写进 design.md                        | 无。规范文档只覆盖「token 分层」+「组件 API 契约」两节，没有原则层                                             |
| 间距一律吸附 4px 网格，六级刻度（`sizeUnit 4` + `sizeStep 4`，margin\*/padding\* 各成序列）                       | **无 spacing token**；组件裸写 `p-3`/`gap-1`（Tailwind 默认值）                                                |
| 圆角按组件类别分档：控件 6 / 表面 8 / 标签与提示 4，且明确禁止相邻元素混半径                                      | **无 radius token**；裸写 `rounded-md`/`rounded`                                                               |
| 字阶含 heading 序列 + 行高 + 字重，且只用两档字重（400 / 600），强调靠色彩与描边不靠加粗                          | 字号仅 4 档（10/12/13/14），**无 heading 序列、无行高与字重 token**                                            |
| 控件高度成刻度（`control-height 32`，SM/LG 派生），Input 与 Button 同高                                           | 无高度 token；`OsButton` 有 `sm/md`（全库唯一 size），`OsInput` 无 size                                        |
| 语义色**派生成梯度**：每个语义 10 级（Bg / BgHover / Hover / Active / Border / BorderHover / Text / TextActive…） | 只有 `danger`/`warning`/`success` 单值 + `accent-strong/soft` 两个 color-mix；**无浅色底 / 无边框 / 无文本态** |
| 表面三层模型（`bg-layout` / `bg-container` / `bg-elevated`），第三层靠阴影而非色相区分                            | 有 `surface×3` + `glass×7`，但未成「布局层 / 容器层 / 浮层」的职责规范                                         |
| 中性色用 alpha 表达（4 档 α），叠加在着色表面上仍能自然混合                                                       | 实色 hex 为主；玻璃层已用 alpha，但文本/填充无分级序列                                                         |
| 阴影分层（Tertiary / Popup / Card / 方向性…），由 `colorShadow` 派生，明暗自适应                                  | 4 个场景阴影（window / window-dim / pop / dock），无层级刻度、无暗色派生                                       |
| `zIndexBase` + `zIndexPopupBase` 两级锚点，弹层统一从 popup 基准起算                                              | **无 z-index token**，壳层散落 `z-[…]`，窗口用运行时递增 zIndex                                                |
| 焦点态成规范（`controlOutline` / `lineWidthFocus` / `focusOutline`）                                              | **全仓 7 处 `outline-none`、0 处 `:focus-visible`**，焦点只靠 `focus:border-accent` 描边，键盘用户几乎看不见   |
| 动效三档时长 + 具名缓动库，明确「不要随手写 cubic-bezier」                                                        | 时长三档已有（120/180/260），**缓动只有 1 个 ease-out**                                                        |
| 响应式按断点序列（`screenXS`~`screenXXXL`）；栅格 / 间隔 / 弹性由布局组件承担                                     | 无断点 token，无栅格组件；窄屏仅「隐藏 Widgets」一处降级                                                       |
| 主题化是一等运行时能力：seed 覆盖、算法切换（default/dark/compact 可组合）、组件级作用域、嵌套作用域继承          | 明暗 + 4 强调色预设已落地（S5），但**无组件级/局部作用域**，无密度算法                                         |

## 3. 组件缺口：72 → 18 的对照

本系统 `src/ui` 现有 18 个 `Os*` 组件 + `OsIcon`（35 个 lucide 图标白名单）。按 antd 的七个类别对齐后：

> **本表与下方「结构性缺陷」均为规划时点（2026-10-05 前）的快照。** S8 建了 barrel 与通用契约，S9 补了布局/容器/展示/树/数值件（`src/ui` 现为 31 件，缺陷 1 与 2 已闭合，含 `OsForm` 那处内联裸 `<textarea>`）；缺陷 3 的复用件 `OsSpin` 与缺陷 4 的命令式入口在 S10。逐件状态见 §9。

| 类别         | antd 有                                                                                                                                                                                       | 本系统有                                          | 判定                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| General      | Button / Typography / Icon / FloatButton                                                                                                                                                      | Button / Icon                                     | **缺 Typography**（其余按需）                                                                              |
| Layout       | Grid / Space / Flex / Divider / Layout / Splitter / Masonry                                                                                                                                   | 无                                                | **整类缺失**                                                                                               |
| Navigation   | Menu / Breadcrumb / Dropdown / Steps / Tabs / Pagination / Anchor                                                                                                                             | Tabs / Pagination                                 | 缺 Menu / Breadcrumb / Dropdown / Steps                                                                    |
| Data Entry   | Form / Input / InputNumber / Select / Checkbox / Radio / Switch / Slider / Rate / Upload / DatePicker / TimePicker / Cascader / TreeSelect / Transfer / AutoComplete / ColorPicker / Mentions | Form / Input / Select / Checkbox / Radio / Switch | 缺 **InputNumber / Textarea / DatePicker / Upload** 等后台高频件；已有件**缺 size/status/disabled 一致性** |
| Data Display | Table / List / Card / Collapse / Descriptions / Tag / Avatar / Badge / Tooltip / Popover / Segmented / Statistic / Timeline / Tree / Calendar / Image / QRCode                                | Table / Badge / Tooltip / Empty / Skeleton        | **缺 Card / Tag / Descriptions / Collapse / Tree / Segmented / Avatar** 等                                 |
| Feedback     | Modal / Drawer / Message / Notification / Alert / Popconfirm / Progress / Result / Spin / Watermark                                                                                           | Dialog / Drawer / Toast / 三态内建                | **缺 Alert / Spin / Progress / Popconfirm / Result**（错误与进行中态无处安放）                             |
| Other        | App / ConfigProvider / Affix                                                                                                                                                                  | 无                                                | **缺 ConfigProvider 等价物**（局部主题 + 语言 + 组件默认值的一处入口）                                     |

结构性缺陷（比「少几个组件」更重要）：

1. **没有 `src/ui/index.ts` barrel**，类型（`TableColumn`/`FormField`/`SelectOption`/`TabItem`）内联散在各 SFC，外部无法按类型消费，文档也无法自动索引。
2. **没有通用 props 约定**（按源码实测）：`size` 全仓只有 `OsButton` 有（且只 `sm`/`md` 两档）；`loading` 只有 `OsTable` 有；`status`（error/warning）全库没有。`disabled` 看着覆盖面还行，但 **`OsInput` 根本没声明它**（全部 props 只有 `placeholder`）——`OsForm` 传的 `:disabled` 只是靠属性透传落到原生 `<input>` 上，契约里看不见、单测也断不到。另外 `OsForm` 的 textarea 字段是**内联裸 `<textarea>`**，绕开了 `src/ui`，属于已存在的复制样式。
3. **三态只在 Table**：List/Tree/Collapse 类新组件若各自实现 loading/empty/error，就违反了路线 §5.4「组件收口」。
4. **静态方法无上下文**：通知走 `useNotification.push` + `OsToast`，形态单一（无 info/success/warning/error 分级）；`OsDialog` 只能声明式挂在模板里，没有命令式确认（antd `Popconfirm`/`Modal.confirm` 的位置）。

## 4. 研发缺口

| 项             | antd 生态做法                                    | 本系统现状                                                                                | 阶段   |
| -------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------ |
| a11y           | 组件内建 role/aria/键盘导航，并有可自动化的检查  | 部分 role（switch/radiogroup/dialog/aria-busy），**无 axe、无焦点可见性、无键盘导航规范** | S12    |
| 文档           | 类型 + demo 双向生成（dumi），文档不会与源码漂移 | VitePress 8 页**全手写**，组件 API 表与源码无自动校验；示例不可点                         | S11    |
| 组件级测试     | 每组件独立测试集 + 快照                          | 单测 18 文件 ≈112 条，但组件按品类合并成 4 个文件，覆盖率阈值全局 60/50 无组件维度        | S8/S12 |
| 提交与变更规范 | 约定式提交 + CHANGELOG                           | changesets 已有；**commitlint 不存在**（husky 只有 pre-commit）                           | S12    |
| 图标           | 图标包按需引入，全量可枚举                       | `kernel/icons.ts` 手写 35 个白名单，加图标要改内核代码                                    | S11    |
| 视觉回归       | 截图基线                                         | 路线 §6 明确「暂不引入」，改用 computed style 断言 —— 本规划**不擅自翻案**，列为开放问题  | §8     |
| CI             | 远端实跑 + 多 job                                | workflow 已写全，但**从未远端实跑**（S6 遗留未决项）                                      | S12    |

## 5. 迭代阶段

### S7 设计语言成文与 token 刻度补全（规模 L）

**目标**：把「设计系统」从一套颜色变量，升级为**有明文原则 + 完整刻度 + 可门禁校验**的地基。S8~S10 的所有组件都从这里取数，因此必须先做。

**关键设计点**

- 原则成文：在《WebOS设计规范与工程基建.md》新增「设计价值观」章，采 antd 四值（自然 / 确定 / 有意义 / 可生长）并按 WebOS 形态改写「确定」——桌面形态没有页面跳转，状态必须由窗口、Dock、通知三处冗余表达；每条价值观配 Do / Don't（对齐 antd 的 Do's and Don'ts 写法）
- 间距：`spacing.css` 引入 4px 基准六级刻度（对应 antd `sizeUnit/sizeStep`），语义别名走容器内边距 / 控件内距 / 间隙三组；**Tailwind 裸值 `p-N`/`gap-N` 由新脚本审计，白名单外即失败**
- 圆角：`--radius-control`（控件）/ `--radius-surface`（卡片、弹层）/ `--radius-chip`（标签、徽标）/ `--radius-full`，并把「相邻元素不得混半径」写进规范
- 字体：补 heading 序列（对齐窗口标题 / 应用内标题 / 正文 / 辅助四档），并新增 `--leading-*`、`--weight-regular/strong`（**只用 400 与 600 两档**，强调靠颜色与描边）
- 控件高度：`--control-height-sm/md/lg`，`OsButton`/`OsInput`/`OsSelect` 同高，作为 S8 通用 `size` 的数值来源
- 色彩派生：为 5 个语义（accent/success/warning/danger/info）**用纯 CSS `color-mix` 派生 bg / bg-hover / border / text / active 五级**，不引 JS 依赖；`info` 需新增 seed。派生公式集中在一处，明暗各调 seed 不动公式
- 中性分级：文本四档 α（对应 antd 0.88/0.65/0.45/0.25）与填充四档（`colorFill` 序列），供禁用态、占位符、hover 底色使用；禁用态从裸 `opacity-40` 收敛为 token
- 层级：`--z-window-base` / `--z-overlay` / `--z-popover` / `--z-toast` 刻度；壳层与 `src/ui` 的 `z-[…]` 全部替换；窗口运行时 zIndex 仍动态分配，但落在 window 基段内
- 焦点：`--focus-ring-color/width/offset` 一套，**取消 `outline-none`**，统一 `:focus-visible` 可见环；玻璃层上的焦点环对比需实测
- 阴影与缓动：阴影改「层级名 + 由 shadow seed 派生」，暗色自动提亮；缓动补 antd 具名集里用得上的 3~4 条
- 窗口级响应式：**不做移动端断点**，改以 CSS **container query** 按窗口宽度定义 `--bp-*`，兑现「窗口可 resize，应用内布局应随之变形」；这是 antd `screen*` 断点在本形态下的等价物

**交付物**：`src/styles/spacing.css`（或并入 tokens.css 的分层）、`theme-light/dark.css` 语义派生段、审计脚本 `scripts/check-tokens.mjs`（裸值扫描 + 报告）、规范文档「设计价值观」「刻度体系」两章、文档站 Token 页重写

**验收标准**

- 全仓 `grep` 无新增裸色值 / 裸间距 / 裸圆角 / 裸字号（脚本作为 `build:check` 前置步骤，超限即 fail）
- 五个语义色各有 5 级派生值，明暗两套下 Alert 类浅底 + 深字对比度实测达 WCAG AA（4.5:1）
- 键盘 Tab 走完壳层 + component-gallery，**每一站焦点环可见**（截图 + computed style 双证）
- 现有 7 应用视觉无回归（暗色/强调色 E2E 全绿）

**依赖**：无（S5 已把 token 分层就位）

### S8 组件契约统一（规模 M）

**目标**：先解决「已有 18 个组件契约不齐」，再谈新增——否则新组件会长在一套不一致的地基上。

**关键设计点**

- 建立 `src/ui/types.ts`：`Size = 'sm'|'md'|'lg'`、`Status = 'default'|'error'|'warning'`、通用 `CommonProps { size?, disabled?, loading? }`；把内联在各 SFC 的 `TableColumn`/`FormField`/`SelectOption`/`TabItem`/`RadioOption` 迁为集中导出（SFC 内保留 re-export 以免破坏现有 import）
- 新增 `src/ui/index.ts` barrel，统一具名导出；验证 Vite 仍按异步 chunk 分包、包体预算不回退
- 逐件补齐：`OsInput`（`size`/`disabled`/`status`/`clearable`/前后缀插槽）、`OsButton`（`loading`、`lg`）、`OsSelect`（`size`/`loading`）、`OsTooltip`（四向 placement）、`OsBadge`（status 圆点型，除计数外）、`OsDialog`（确认按钮 loading、mask 关闭可配）
- 三态复用契约：把 Table 的 loading/empty/error 实现抽成可复用内部件（`OsSpin` 于 S10 落地后接管 loading），约定「任何数据类组件必须复用该契约，不得自写」
- 每组件补 props/emit 契约单测，并按组件拆文件（撤销 S3 的按品类合并，因为组件数已到需要独立定位问题的量级）

**交付物**：`src/ui/types.ts`、`src/ui/index.ts`、6 个组件的契约扩展、契约单测重写、component-gallery 增「通用约定」段（size/status/disabled/loading 同屏对照）

**验收标准**

- 任一组件的 `size` 三档高度与 `--control-height-*` 完全一致（computed style 断言）
- `disabled` 与 `status='error'` 在 Input/Select/Checkbox/Radio/Switch/Form 上表现一致（同一套断言跑一遍）
- 现有应用与 E2E 零回归；`build:check` 包体预算不回退

**依赖**：S7（size 刻度、focus ring、禁用态 token）

### S9 组件纵深 · 布局与展示（规模 M）

**目标**：补齐「拼一个后台页面最少要的那几块」，让业务侧不再手写 div 容器。

**关键设计点**（P0，全部消费 S7 刻度）

- 布局：`OsSpace`（间隙 + 对齐，替代裸 `flex gap-*`）、`OsDivider`、`OsGrid`（窗口宽度自适应的列，基于 container query 而非视口断点）
- 容器：`OsCard`（标题 / 操作区 / 内容 / 无内边距变体，对应 antd 表面层职责）、`OsCollapse`
- 展示：`OsTypography`（text / title / paragraph / link，含省略与「展开」，对应 antd Typography）、`OsTag`（语义 + 预设色，**明确只做标签用途**，状态用 Badge/Alert）、`OsAvatar`、`OsDescriptions`（详情键值对，供抽屉内查看详情复用）、`OsSegmented`
- 树：`OsTree`（含可选复选框、懒加载、键盘导航）——file-manager 的目录树是它的天然消费者
- 录入补全：`OsInputNumber`、`OsTextarea`（autosize；同时**收口 `OsForm` 里那处内联裸 `<textarea>`**，让表单所有控件都出自 `src/ui`）

**硬约束**：新组件一律走 barrel 导出 + 集中类型；schema 优先但每个字段留插槽逃生口（开闭原则）；每个组件必须有 gallery 示例 + 契约单测。

**验收标准**

- file-manager 目录树改为消费 `OsTree`（保留现有 VFS 行为不回归）；data-board 的统计头改 `OsCard` + `OsDescriptions`
- 文档站每新组件一页，API 表与 `types.ts` 一致（S11 前先在 gallery 与文档双写，S11 起自动化）
- 单测较 S8 显著增长且组件维度无空档

**依赖**：S7、S8

### S10 组件纵深 · 反馈与导航（规模 M）

**目标**：把「进行中 / 部分失败 / 致命错误」这三类目前无处安放的状态，收成组件级标准语义。

**关键设计点**

- 反馈：`OsAlert`（四语义 + 可关闭 + 插槽，浅底用 S7 派生色）、`OsSpin`（容器遮罩 + 内联两型，接管 S8 定义的中性 loading 契约）、`OsProgress`（条形 / 环形）、`OsResult`（成功 / 失败 / **403 无权限** / 未知异常四型；其中 403 直接承接 S2 的鉴权拒绝——目前只在通知中心留痕，没有落地页）、`OsPopconfirm`（轻确认，替代「为一个小操作开一个 `OsDialog`」）
- 命令式入口：`notify.success/error/warning/info()` 与 `confirm()` 走上下文而非全局单例（对应 antd `App`/`ConfigProvider` 的静态方法上下文问题），仍复用现有 `useNotification` store，**不另起一套通知系统**
- 导航：`OsDropdown`（菜单型浮层，含键盘）、`OsMenu`（模式：横向/纵向）、`OsBreadcrumb`（file-manager 路径栏是其天然消费者）、`OsSteps`
- 浮层定位统一：现在 Tooltip 只支持两向、Dropdown/Popover 缺失，本阶段引入**统一定位原语**（`src/ui/internal/placement.ts`，自写不引依赖），所有浮层共用；z-index 走 S7 刻度

**验收标准**

- settings 里「诊断日志」条目用 `OsAlert` + `OsResult` 重排；file-manager 路径栏换 `OsBreadcrumb`，均功能不回归
- 抛错演练：窗口错误态由 `OsResult` 呈现，且能重载（S6 的 ErrorBoundary 接入）
- 所有浮层可用键盘打开/关闭/Esc，焦点环可见；`OsToast` 分级后与通知中心一致

**依赖**：S7、S8（三态契约）、S9（Dropdown 依赖 Card/Space 的内部排版件）

### S11 全局配置层与文档自动化（规模 M）

**目标**：兑现「一处配置，全局生效」，并让文档不再与源码漂移——这两点 antd 做得比 demo 级实现成熟的地方。

**关键设计点**

- `OsConfigProvider`（本系统等价物）：**一个** 应用内可套的作用域入口，聚合 `locale` / `theme`（局部覆盖 accent、radius、controlHeight 等）/ `componentDefaults`（如整棵子树 `size='sm'`）。纯 CSS 变量 + `provide/inject` 实现，不引运行时样式生成
- 组件内建文案（「共 N 条」「重试」「确定」「暂无数据」…）从散落走向 `locale` 命名空间统一；补齐 S5 遗留的「应用内容文案未接入」
- 文档自动化：从 `src/ui/types.ts` + 各 SFC 的 props 定义生成 API 表（薄脚本，产出 Markdown 片段给 VitePress 引入）；gallery 的示例改**可嵌入复用**，文档页与 gallery 共用同一份示例源，避免两处维护
- 图标：`kernel/icons.ts` 白名单改为按 lucide 全量动态解析 + 显式子集校验（新增图标不改内核），并核对分包不受影响
- 组件 API 破坏性变更走 changesets `minor/major` 标注

**验收标准**

- 在某应用内单独套 `OsConfigProvider` 改 accent 与 size，只影响该子树，刷新后持久化不越界
- 删掉文档站手写的组件 API 表，改为生成物；故意改一个 props 名后 `docs:build` 失败（证明校验真的生效）
- 切语言后组件内建文案全变（含 Table 分页、Empty、重试按钮）

**依赖**：S9、S10（组件集稳定才有可生成的 API 面）

### S12 质量线：无障碍、回归门禁与流程（规模 M）

**目标**：S7~S11 铺了 30+ 个组件的视觉与交互面，需要机器兜住而不是靠人工复核。

**关键设计点**

- a11y：引入 axe 自动检查（Playwright 内），对壳层 + gallery 全量组件页跑；建立「可交互组件必达」清单（label、`aria-*`、键盘、对比度、动效偏好 `prefers-reduced-motion` 降级）
- 键盘与焦点规范成文：Tab 顺序、Esc 关闭、焦点返回（Dialog/Drawer/Dropdown 关闭后回触发元素）——这是目前完全缺失的一类行为
- E2E 拆分：现在 34 条里仍有 16 条挤在 `smoke.spec.ts`（壳层/权限/组件/主题/可观测混在一起），按主题拆 `smoke` / `permission` / `data` / `theme-i18n` / `components`，并补「组件交互」维度用例
- 覆盖率加组件维度下限（每个 `src/ui` 组件至少 N 条断言），避免只增行数不增覆盖
- `commitlint` + `commit-msg` 钩子（对齐既有中文「类型：描述」单行约定）
- **CI 远端实跑收口**：S6 遗留项，需 `git push` 触发 Actions 并回看结果——这是影响远端的操作，执行前需用户确认
- 视觉回归：是否引入截图基线，作为 §8 开放问题在 S10 收尾时评估，不预先承诺

**axe 预跑结论（2026-10-05，S12 的工作清单）**

`tests/e2e/a11y.spec.ts` 已落地（4 个场景：壳层冷启动 / Spotlight / 组件陈列逐页签 / 设置窗口），用 `A11Y=1 npx playwright test a11y` 显式开启——S10/S11 仍在改壳层与组件，默认跳过以免污染各阶段门禁。正式接入时改成默认执行 + 独立 CI job。首次实跑（S10-A 进行中的工作树）暴露的 serious/critical 违规：

| 规则             | 量级                             | 根因（已定位到源码）                                                                                                                                                             | 归属                                                      |
| ---------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `button-name`    | 每个场景各 1 处                  | 顶栏通知中心触发钮 `<button class="relative">` 内只有图标 + 角标，无可读文本，缺 `aria-label`                                                                                    | 壳层                                                      |
| `select-name`    | gallery 基础 8 / 录入 2 / 布局 1 | `OsSelect` 内部原生 `<select>` 无 `aria-label`，`placeholder` 只是首个 disabled `<option>`                                                                                       | S11 文案收口时一并给 `OsSelect` 加 `aria-label` 契约      |
| `label`          | 录入 5 / 展示 8 / 基础 1         | `OsInput` / `OsInputNumber` / `OsTextarea` / `OsTree` 复选框 / `OsCheckbox` 均无可访问名——组件只接受 `placeholder`，没有 label 通道                                              | S12 组件契约补 `ariaLabel`                                |
| `color-contrast` | 基础 8 / 设置 2 / Spotlight 1    | **两处刻度缺陷，不是零散样式问题**：① `--color-ink-mute`（#94a3b8）叠白底仅 2.56:1，正文级 `text-caption` 用它不达标；② 实底按钮 `text-white` on `bg-accent`（#0ea5e9）仅 2.77:1 | S12 改派生：mute 下沉一档 + 实底件按亮度选 on-accent 前景 |

> **对 S7 验收口径的修正**：S7 的 `contrast.spec.ts` 只测了「语义色浅底 + 深字」五组配对（accent/success/warning/danger/info 的 `bg` ↔ `text`），**没有覆盖中性文本三级 `ink-*` 与实底控件前景**。所以「对比度实测通过」这句结论是局部的，不构成 AA 达标。axe 这一层补的正是这个盲区。

**验收标准**

- axe 报告 0 个 serious/critical；对比度抽查含暗色 + 4 个 accent 预设
- CI 远端实跑一次通过，含新增 a11y job（push 前先征得用户同意）
- E2E 分文件后总条数不减，且新增组件交互用例全绿

**依赖**：S9、S10、S11

## 6. 顺序与依赖

```text
S7 设计语言与 token 刻度 ──→ S8 组件契约统一 ──┬─→ S9 布局与展示 ──┐
                                               └─→ S10 反馈与导航 ─┴─→ S11 配置层与文档自动化 ──→ S12 质量线
```

- 严格串行：**S7 必须先做**。S8~S10 的 size/间距/圆角/焦点/派生色全部依赖 S7 的刻度；反过来若先铺组件，S7 落地时要回改所有组件，正是路线 §5.3 想避免的返工。
- S9 与 S10 可并行（不同文件、不同工作线），但分开提交。
- 每阶段一条工作线：单独提交、单独验收、单独回写第 9 节。

## 7. 组件取舍清单（明确不做）

antd 72 个组件里，以下**不纳入本规划**，并给出重新评估的触发条件（避免无声遗漏）：

| 不做                                                                                      | 理由                                               | 触发重评条件                                          |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------- |
| Grid 的视口断点体系                                                                       | WebOS 是桌面形态，自适应单位是**窗口**不是屏幕     | 若真做窄屏适配（现路线 §6 列为范围外）                |
| Calendar / TimePicker / DatePicker（P1）                                                  | 手写成本高于收益，且当前 7 个应用无日期语义数据    | data-board 或新应用出现时间筛选需求                   |
| Upload                                                                                    | 纯前端无服务端，VFS 已覆盖「文件进来」的语义       | 引入真实文件选择 → 用 `OsInput` 文件型 + VFS 写盘评估 |
| Transfer / Cascader / Mentions / Slider / Rate                                            | 无消费场景，属业务功能而非脚手架能力               | 具体应用提出需求时按 OCP 加 variant 或单独立项        |
| Image / QRCode / Watermark / Carousel / Tour / Affix / BorderBeam / FloatButton / Masonry | 装饰性或营销向，与「企业后台脚手架」定位无关       | 不做                                                  |
| Popover                                                                                   | 与 Tooltip/Dropdown 重叠，先统一浮层定位原语再评估 | S10 落地后若确有富内容浮层需求                        |
| compact 密度算法                                                                          | 路线 §7 已列为可选且「先看收益」                   | S9/S10 组件铺开后评估                                 |

## 8. 开放问题

| 问题                                                   | 评估时点         | 倾向                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 视觉回归基线是否推翻路线 §6 的「暂不引入」             | 已定（S10 收尾） | **翻案，但取「只做组件级快照」窄口径**：不做全页面像素回归，只对 8~10 个高价值界面（壳层/窗口/浮层/表格/表单/设置）建 Playwright 截图基线，基线随仓库提交、CI 比对，字体与动效抖动区用 mask 排除。实施排入 S12。理由：组件破 40 后「computed style 断言 + 人工浏览器复核」的边际成本已经高于基线维护成本，而全页面基线在纯前端 demo 里噪声太大、易成假失败源 |
| 组件是否独立发包（monorepo）                           | 已定（S10 收尾） | **维持单仓 + 目录边界**，不拆包。把「`src/ui` 只经 `@/ui` 边界消费」写进规范（业务应用按件路径引入是包体预算线，见 S9 修正条），S11 的 `OsConfigProvider` 把 API 面稳定后再评估是否值得发包                                                                                                                                                                  |
| 色彩派生用纯 CSS `color-mix` 还是引 JS 色板库          | 已定（S7）       | 纯 CSS，未引依赖；六级派生够用，若出现需要 10 级精确 ramp 的场景再评估                                                                                                                                                                                                                                                                                       |
| `OsConfigProvider` 是否会与现有 `theme` store 职责重叠 | S11 开工前       | store 管全局持久化设置，Provider 管子树局部覆盖，边界写进规范                                                                                                                                                                                                                                                                                                |
| 35 图标白名单改全量后包体影响                          | S11 实测         | 先测 lucide 按需导入是否真增 chunk；超预算则保留白名单 + 生成脚本                                                                                                                                                                                                                                                                                            |

## 9. 实施状态

| 阶段  | 状态                 | 说明                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S7    | 已完成（2026-10-05） | 刻度层重写（间距/圆角/字阶/字重/控件高/语义色六级/中性填充/层级/动效/阴影）+ 派生公式单点化；`check-tokens.mjs` 十类规则 + 棘轮基线上线并挂 `build:check`/CI；焦点环与禁用态收口；container query 三档落地 data-board；对比度/焦点/换行三条 E2E 门禁（29 条 E2E 全绿）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| S8    | 已完成（2026-10-05） | `src/ui/types.ts` 集中契约 + `index.ts` barrel + `internal/control.ts`（刻度→类名单点）+ `internal/ControlShell.vue`（Input/Select 共用外框）；六件契约补齐（Button/Input/Select/Tooltip/Badge/Dialog）；跨组件一致性断言收进 `tests/unit/contract-helpers.ts`，单测按组件拆成 18 个文件；新增控件像素高度 E2E                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| S9    | 已完成（2026-10-05） | 新增 13 件（`OsTypography/OsCard/OsGrid/OsSpace/OsDivider/OsAvatar/OsTag/OsDescriptions/OsCollapse/OsTree/OsTextarea/OsInputNumber/OsSegmented`），`src/ui` 达 31 件 + `internal/scale.ts`；file-manager 目录树迁 `OsTree`（VFS 行为不回归，另得键盘导航与勾选联动）、data-board 统计头改 `OsCard` + `OsDescriptions`、`OsForm` 的内联裸 `<textarea>` 收口为 `OsTextarea`；gallery 新增「布局」「展示」分区；单测 44 文件 / 303 用例；E2E 34 条（新增目录树「鼠标展开+选择」与「方向键展开/移动/回车/回父级」两条，键盘导航只在真实浏览器里可验）；文档站新增 `components/layout`、`components/display` 两页并扩 `form`/`index`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| S10-A | 已完成（2026-10-05） | 反馈件五件（`OsAlert/OsSpin/OsProgress/OsResult/OsPopconfirm`）+ 定位原语 `src/ui/internal/placement.ts`（12 值 `Placement`，类串全静态字面量，明确不做 viewport 翻转）；z 层级收口：新增 `--z-sticky: 20` 档 + `@utility z-sticky`，`check-tokens.mjs` 的 `z-literal` 收紧为能抓裸 `z-10/z-50`（此前只抓 `z-[…]`，是个真漏洞），fixture 与断言同步增强而非削弱；`OsTooltip` 改消费原语、`OsDialog z-20→z-float`、`WindowFrame z-10→z-window`、`OsTable` 粘性表头 `z-10→z-sticky` 且 loading 态由骨架屏换 `OsSpin`；28 件组件的 props/emits 补 115 条单行 JSDoc（供 API 表生成消费）；文档站 S10 反馈件段落改为 `<!--@include: ../.generated/api/*.md -->` 引生成物                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| S10-B | 已完成（2026-10-05） | 导航件四件（`OsMenu/OsDropdown/OsBreadcrumb/OsSteps`）：`OsDropdown` 复用 `OsMenu`（键盘委托不重抄）、`OsBreadcrumb` 超长折叠复用 `OsDropdown`、`OsSteps` 四态由 `current`+`error` 推导并在 `w-narrow` 自动纵向退化；菜单键盘走 OsTree 同款 roving tabindex（`focusFirst()` 暴露给浮层）；file-manager 路径栏迁 `OsBreadcrumb`（`navigate(path)` 语义不变）、gallery 新增「导航」页签（共 6 个）；单测 4 文件 38 例 + `tests/e2e/nav.spec.ts` 6 例（方向键展开/换组/归焦、disabled 项 Enter+force 双路径、折叠面包屑、文件管理双击进目录与点层级返回）；文档站 `components/nav` 页                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| S10-C | 已完成（2026-10-05） | 命令式反馈：`src/ui/feedback.ts` 契约层（`useFeedback`/`provideFeedback`，走 provide/inject 而非模块级单例，未挂宿主直接抛错）+ `src/shell/FeedbackHost.vue`（挂在壳层根，`confirm` 用 `OsDialog` 渲染、后发起的确认覆盖前一个并判其取消，不留永不 resolve 的 Promise）；通知分级 `NoticeLevel` 收进 `useNotification`（缺省 info，旧调用方零改动），分级→配色/图标/`aria role` 表**只在 `src/ui/internal/level.ts` 一处**，`OsAlert`/`OsToast`/`NotificationCenter` 三处共同消费（`OsToast` 的 `role` 由等级派生：error/warning 走 `alert`，其余 `status`）；三处迁移：settings 诊断块改 `OsAlert`+`OsTag`+`OsResult`（顺带去掉手写的 `bg-danger/15` 裸透明度 chip）、`ErrorBoundary` 窗口错误态改 `OsResult`、file-manager 删除改 `feedback.confirm` → 成功再 `feedback.success`；gallery 反馈页签新增 `useFeedback` 演示；`OsPopconfirm` 补「外点关闭不抢焦点」同类修正（与 OsDropdown 同一守卫口径）；单测 7 例（feedback）+ popconfirm/toast 各 1 例，E2E 新增 `tests/e2e/feedback.spec.ts` 5 例（分级吐司 `aria role` + 通知队列、确认取消不执行动作、file-manager 删除先过确认才进回收站、settings 诊断块的 OsAlert 计数/OsTag 分级/空态 OsResult、403 出口的「去设置」能开窗）；单测 54 文件 / 412 例，E2E 45 通过 / 4 跳过（跳过的是默认关闭的 a11y 扫描），首屏 225.2KB（预算 700KB） |
| S11   | 未开始               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| S12   | 未开始               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

**实施期对本规划的修正（回写此处）**

- 「纯 CSS `color-mix` 还是 JS 色板库」定案：**纯 CSS**。派生公式集中在 `tokens.css:root` 一处，明暗与四套强调色预设只换 seed，未引任何依赖；六级为 seed/hover/active/bg/bg-hover/border/text（比规划的「五级」多一级 `bg-hover`，因为选中行的 hover 态没有它只能靠不透明度硬凑）。
- 规划写「`spacing.css` 引入六级刻度」，实际**并入 `tokens.css`**：刻度与语义名同源分文件反而容易漂移，且 `@theme` 需要一次性看到全貌。
- 规划的 `--z-window-base/--z-overlay/--z-popover/--z-toast` 四档扩成**七档**（补 `desktop/panel/float/shell` 的区分）：壳层（顶栏/Dock）必须恒高于一切浮层，而对话框必须压过 Spotlight 遮罩，四档表达不了这两个相反的约束。
- 新增规划未列的刻度：字阶 `display-1/2/3`（桌面标语与时钟原本用 `text-5xl/4xl` 裸档，不补档位就只能豁免）、中性填充四档 `fill-*`。
- 一处**规划外**的必要修正：`@theme` 必须写 `@theme static`，否则 Tailwind 摇掉未被工具类引用的变量，运行时读不到 `--color-*-bg/-text`，对比度门禁无从测量。
- 「契约单测按组件拆文件」落地时把 S3 合并的 `ui.test.ts`/`ui-inputs.test.ts`/`ui-feedback.test.ts` 三个文件**全部**拆开（不只规划点名的六件），18 个组件各自可定位。
- 规划要求「size 三档高度与 `--control-height-*` 完全一致（computed style 断言）」在 happy-dom 里做不到：它不加载 Tailwind 产物，`getComputedStyle().height` 与 `var(--control-height-*)` 实测都是空串。拆成两层——单测断言类名令牌，像素值由新增的 `tests/e2e/control-height.spec.ts` 在真实浏览器里读刻度变量并断言 24/28/32。**单测不假装量像素**。
- `Placement` 暂留 `OsTooltip.vue` 内联（四向 CSS 类映射只有它一个消费者）。S10 落 `src/ui/internal/placement.ts` 统一弹层定位原语时一并迁走，届时 OsDropdown/OsPopconfirm 共享。
- 三态复用契约这一条**只做了约定与现状收口**（Table 的 loading/empty/error 仍是唯一实现处），真正的复用件是 S10 的 `OsSpin`，不在本阶段提前造。
- 引入 barrel 后首屏 JS 从 205.8KB 涨到 208.4KB（+2.6KB，预算 700KB），7 个应用异步 chunk 分包未回退。
- 控件密度不跟 antd：控件高刻度取 **24/28/32**（缺省 28）而非 antd 的 24/32/40。桌面 WebOS 的窗口可视区比常规网页更金贵，S5 前实测 28px 一排控件的观感与密度平衡最好；这条差异是刻意的，不是漏抄。
- **S9** 规划写「新组件一律走 barrel 导出」，实际拆成两层：`@/ui` barrel 是**对外 API 面**（类型与组件同名出口，gallery 全量消费），业务应用仍按件路径 `@/ui/OsCard.vue` 引入——30 件里单个应用平均只用 4~6 件，走 barrel 会把整包拉进首屏（S8 实测已 +2.6KB），7 个应用的异步分包是 S6 定的预算线，不能为书写好看回退。
- **S9** 验收里的「data-board 统计头改 `OsCard` + `OsDescriptions`」有个前提错误：磁盘上的 data-board **从来没有统计头**。实施时按规划意图新建了一块统计概览卡（在筛选栏之上），内容全部由该页已有的 `total/rows/dept/keyword` 状态派生，未新增数据源、未编造指标。
- **S9** `OsTextarea` 的 `size` 只驱动**内边距**刻度，不套 `h-control-*`：多行控件的高度属于 `rows`/`autosize` 语义，§3.4 控件高表本来就只列 Button/Input/Select。
- **S9** `OsTree` 的 `checkedKeys` 用「**终端 key**」语义（写回的是叶子集合，父节点只呈现 checked/indeterminate 聚合态），不同于 antd 的 `checked + halfChecked` 双数组。理由：目录树父节点折叠或懒加载未展开时，双数组会随可见性漂移；终端 key 集合是稳定的，父子关系在组件内一次推导。`disabled` 节点不参与父聚合。
- **S9** `OsGrid` 的列数降档表写成**静态字面量**（`'grid-cols-1 w-mid:grid-cols-2 …'` 整串），不能按 `columns` 拼字符串——Tailwind 靠源码扫描生成变体类，拼接出来的类名不存在。
- **S9** gallery 里 `:columns="3"` 的示例在窗口内只渲染 2 列，实测该 `.cq-window` 容器宽 **726px**，落进 `w-mid` 降档——**这是容器查询按预期工作，不是变体失效**。`tests/e2e/container.spec.ts` 已把「同一行 → 换行」固化成门禁。
- **S9** 验收写「文档站每新组件一页」，实际沿用站点既有的**分组页**风格（`table`/`form`/`feedback` 各覆盖多件）：新增 `components/layout`（6 件）与 `components/display`（5 件），`form` 页扩 `OsTextarea`/`OsInputNumber`，`index` 表补齐 32 件。一页一件与「API 表从 `types.ts` 生成」是 S11 的同一件事，不在此提前手工铺开。
- **S9** `OsInputNumber` 的 model 取 `number | undefined`（清空即 `undefined`），且**逐键不写回**：文本态留在组件内，`change`/`blur` 才提交并钳制，非法片段回退上一个合法值。antd 的 `value: number | null` 在这里会跟 `Status`/空值语义打架。
- **S10-A 事故（已收口为门禁）**：新增 locale 文案里写了「派发 `@close`」，vue-i18n 把 `@` 当 linked message 语法，**消息是运行期首次取词才编译的**——单测逐件挂载碰不到，真实浏览器里整个 gallery 窗口直接进错误边界。修法：文案改「close 事件」，并给 `tests/unit/i18n.test.ts` 加「两份 locale 全部叶子消息 `t()` 一遍不得抛错」的守护用例（已反向验证：把 `@close` 塞回去用例会红并点名 `gallery.alertHint`）。**约束**：i18n 文案禁用 `@` 起头与 `@:xxx`。
- **S10-A 门禁补漏**：`check-tokens.mjs` 的 `z-literal` 此前只匹配 `z-[…]`，裸 `z-10 / z-20 / z-50` 一路放过（`OsDialog`、`WindowFrame`、`OsTable` 粘性表头、`OsTooltip` 四处实际在裸写）。现收紧为 `\bz-\[[^\]]+\]|\bz-\d`，新增 `--z-sticky: 20` 档承接「容器内粘性叠层」这一类此前无归属的层级，并把裸值加进 tokenAudit fixture。
- **S10-A 顺带发现的三处既有缺陷（S10 收尾已修，2026-10-05）**：① `OsTable` 只要 `total !== undefined` 就渲染页脚，但**表体从不按页截取行**，本地模式下「分页」是假的 → 现本地模式按 `v-model:page` + `page-size` 截当页行，`remote` 模式**不截**（父级只传当页数据，再截会翻空），「全选」仍只作用于当前展示行；② `OsDrawer` `placement="left"` 的滑入动画固定 `translateX(100%)` 不镜像 → 面板挂 `slide-from-left`，用双类选择器特异度覆盖默认轨迹；③ `OsRadio` 的 `name` 缺省写死 `'os-radio'`，同页多组不显式传 `name` 会跨组互串 → 缺省改用 `useId()` 生成实例级组名（`OsCollapse`/`OsTypography` 已有同一手法）。三处各加/改单测：分页两条用例（截行与 remote 不截）、抽屉两侧轨迹类名、radio 同页两组的组名互不相同。**坑记录**：单测里 `mount()` 两次是两个独立 app，`useId()` 在两个 app 里都会得到 `v-0`，断言唯一性必须把两个实例挂进**同一个父组件**再测。
- **S7 验收口径修正**：`contrast.spec.ts` 只覆盖五语义的「浅底 + 深字」配对，**未覆盖中性 `ink-*` 三级与实底控件前景**，所以当时那句「对比度实测通过」是局部结论。axe 层预跑已量化缺口（`ink-mute` 2.56:1、白字 on `bg-accent` 2.77:1），详见 §5 S12「axe 预跑结论」。
- **S10-A 文档↔代码改正 8 处**（回灌 props 注释时逐条以源码为准，文档错的地方已按代码写）：`OsBadge.count` 实为可选且 `count <= 0` 整节点不渲染、`dot`/`status` 两 prop 文档漏写；`OsDialog` 漏 `loading`/`maskClosable`，且「点遮罩取消」只在 `maskClosable=true` 时成立；`OsCard` 插槽恒优先于同名 prop、只给 `extra` 插槽也会出 header；`OsDescriptions` 的 `column=2` 从 `w-mid`（480px）起生效而非「宽窗口」；`OsSelect` 的 `placeholder` 默认 `'请选择'` 是写死中文、家族里唯一未走 i18n 的一处（S11 收口）；`OsTable` 的 loading 态现渲染 `OsSpin` 而非骨架屏。
- **S10-C 「403 落地页」的实际形态**：规划要求 403 承接 S2 鉴权拒绝「目前没有落地页」。实施时先核了触发面——Dock、Spotlight、应用中心都只列 `registry.accessibleApps`（Dock 再经 `isPinned` 过滤），已发布三角色（admin/editor/guest）也凑不出「可访问应用深链到不可访问应用」的组合，所以 `wm.open` 的鉴权拒绝分支在现有 UI 里**没有自然入口**。据此不新增中断式弹窗（那会与「通知中心留痕 + 去设置出口」的非阻塞设计重复），落地形态定为：`OsResult status="403"` + `extra` 插槽的「去设置」出口，由 gallery 反馈页签端到端演示（新增 E2E 断言点出口能开设置窗），kernel 侧继续只写 warning 级通知。将来出现越权深链或受限角色时，同一件直接承接。
- **S10-C 分级表只留一处**：`OsAlert` 的四档 tint、`OsToast` 的图标/前景、`NotificationCenter` 的条目图标此前各写各的（`OsAlert` 内联一份、`OsToast` 硬编码 `bell` + `text-accent-strong`、通知中心无图标），现全部收进 `src/ui/internal/level.ts`。`OsToast` 的 `role` 从恒 `status` 改为按等级派生（error/warning → `alert`，success/info → `status`），`useNotification.push` 的 `level` 为**可选尾参**且缺省 info，因此旧调用方（含 `vfs` boot 的 remove/restore 提示）行为不变。
- **S10-C 浮层关闭的焦点归还同类缺陷**：`OsPopconfirm` 的 `hide()` 无条件把焦点 `focus()` 回触发容器，外点关闭时焦点已经属于用户点中的那个元素，于是被抢走（点表格行同时收起浮层 → 行选不上）。改为与 `OsDropdown` 同一守卫口径：仅当 `document.activeElement` 仍在触发区内才归焦。单测新增「外点关闭只收起，不把焦点从用户点中的元素抢回」一条，断言 `document.activeElement` 保持在外部按钮上。
- **S10 门禁实测一处竞态（已在本阶段修）**：`smoke.spec.ts` 的「Spotlight 搜索并打开文档」在并行 worker 下偶发假失败——`⌘K` 的监听挂在 `App.vue` 的 `onMounted`，而 Playwright 的 `goto` 在 `load` 事件即返回，Vite 的模块图可能在 load 之后才完成挂载，按键早于监听注册。修法是加就绪屏障：按键前先 `expect(getByRole('banner')).toBeVisible()`，不放松任何断言。同一提交里该文件的页签数断言由 5 改为 6（新增「导航」页签）。
