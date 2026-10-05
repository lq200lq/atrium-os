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
- E2E 拆分：现在 16 条全挤在 `smoke.spec.ts`，按主题拆 `smoke` / `permission` / `data` / `theme-i18n` / `components`，并补「组件交互」维度用例
- 覆盖率加组件维度下限（每个 `src/ui` 组件至少 N 条断言），避免只增行数不增覆盖
- `commitlint` + `commit-msg` 钩子（对齐既有中文「类型：描述」单行约定）
- **CI 远端实跑收口**：S6 遗留项，需 `git push` 触发 Actions 并回看结果——这是影响远端的操作，执行前需用户确认
- 视觉回归：是否引入截图基线，作为 §8 开放问题在 S10 收尾时评估，不预先承诺

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

| 问题                                                   | 评估时点   | 倾向                                                                                      |
| ------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------- |
| 视觉回归基线是否推翻路线 §6 的「暂不引入」             | S10 收尾   | 组件到 30+ 后人工截图复核成本确实上升；但需先确认 CI 能稳定产出与比对基线，再决定是否翻案 |
| 色彩派生用纯 CSS `color-mix` 还是引 JS 色板库          | S7 开工前  | 纯 CSS（不引依赖、暗色只需换 seed）；若出现需要 10 级精确 ramp 的场景再评估               |
| `OsConfigProvider` 是否会与现有 `theme` store 职责重叠 | S11 开工前 | store 管全局持久化设置，Provider 管子树局部覆盖，边界写进规范                             |
| 35 图标白名单改全量后包体影响                          | S11 实测   | 先测 lucide 按需导入是否真增 chunk；超预算则保留白名单 + 生成脚本                         |
| 组件是否独立发包（monorepo）                           | 组件 > 30  | S9/S10 后组件数翻倍，届时重新评估；当前单仓 + 目录边界够用                                |

## 9. 实施状态

| 阶段 | 状态   | 说明 |
| ---- | ------ | ---- |
| S7   | 未开始 |      |
| S8   | 未开始 |      |
| S9   | 未开始 |      |
| S10  | 未开始 |      |
| S11  | 未开始 |      |
| S12  | 未开始 |      |

**实施期对本规划的修正（回写此处）**

- （待补）
