# WebOS 设计规范与工程基建

> 目标：把 WebOS 前端从「功能 demo」升级为**企业级基础项目**——改任何东西都有门禁、有 token 可依、有组件可复用。载体保持 WebOS 桌面形态（见《WebOS前端架构设计.md》）。
>
> 本轮范围：**只打底**。不铺组件数量、不做文档站（Storybook/VitePress 留待组件库路线启动时评估）。

## 1. 打底内容一览

| #   | 项            | 产出                                  | 验收                                      |
| --- | ------------- | ------------------------------------- | ----------------------------------------- |
| 1   | 工程规范      | ESLint + Prettier + husky/lint-staged | `npm run lint` 干净，提交前自动检查       |
| 2   | 单测基建      | Vitest + @vue/test-utils + happy-dom  | 核心纯逻辑有测试且全绿                    |
| 3   | E2E 冒烟      | Playwright                            | 关键路径可回归，替代手工点测              |
| 4   | CI 门禁       | GitHub Actions                        | type-check + lint + test 挂在每次 push/PR |
| 5   | 设计 token 化 | CSS 变量 + Tailwind `@theme` 映射     | 源码无散落色值/魔法时长                   |
| 6   | 基础组件收口  | `src/ui/` 形态无关基础组件            | 壳层与应用统一消费，无重复实现            |

## 2. 工程规范

### 2.1 工具链与脚本

| 项     | 选择                                     | 说明                                                                                                   |
| ------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Lint   | ESLint flat config（`eslint.config.js`） | `eslint-plugin-vue` + `typescript-eslint`；规则集偏严格，禁止 `no-console`（dev 除外）、未使用变量报错 |
| 格式化 | Prettier                                 | 与 ESLint 分工：ESLint 管正确性，Prettier 管排版；singleQuote、printWidth 100                          |
| 预提交 | husky + lint-staged                      | 提交前对暂存文件跑 `eslint --fix` + `prettier --write`；提交前跑 `type-check` 门禁                     |

`package.json` 脚本约定（全仓统一入口，CI 与本地同一套）：

```text
dev / build / preview / type-check
lint / lint:fix / format
test:unit / test:unit:watch / test:e2e
```

### 2.2 提交规范

- 中文单行「类型：描述」：`feat：…` / `fix：…` / `refactor：…` / `test：…` / `docs：…` / `chore：…`
- 一个 commit 只装一条工作线；逐文件名 `git add`，禁止 `git add -A`
- 不替并行工作线提交 WIP

### 2.3 测试策略

| 层   | 工具                     | 覆盖对象                                                     | 不做什么                     |
| ---- | ------------------------ | ------------------------------------------------------------ | ---------------------------- |
| 单元 | Vitest + happy-dom       | store 纯逻辑（windowManager/vfs/icons/notification）、纯函数 | 不测视觉                     |
| 组件 | Vitest + @vue/test-utils | 基础组件（src/ui）的 props/emit 契约                         | 不测样式渲染像素             |
| E2E  | Playwright               | 冒烟链路：启动→开窗→拖拽→Dock→Spotlight→持久化刷新还原       | 不穷举交互                   |
| 视觉 | 浏览器截图人工复核       | 改视觉时抽查                                                 | 不做视觉回归基线（暂不引入） |

### 2.4 CI

`ci.yml`：install → `type-check` → `lint` → `test:unit` → `test:e2e`。任一失败即挡合并。

## 3. 设计 token 体系

### 3.0 设计价值观（S7 成文，作为一切取舍的仲裁依据）

四条价值取自企业级设计系统的共识，并按 WebOS 桌面形态重新解释。**两条决策规则**：① 两个方案冲突时，选让用户状态更「确定」的那个；② 不产生信息的装饰一律删掉。

| 价值观            | 在 WebOS 里的含义                                                                                                      | 落点示例                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 自然 Natural      | 沿用操作系统与既有企业软件的既成模式，不发明新交互：窗口有交通灯、Dock 承载常驻、⌘K 唤起搜索                           | 窗口拖拽/缩放走 pointer 事件与 macOS 手感一致；不做「双击标题栏才折叠」这类奇招          |
| 确定 Certain      | 用户永远知道「我在哪 / 我刚做了什么 / 下一步是什么」。桌面形态没有页面跳转，状态必须由**窗口、Dock、通知三处冗余表达** | 鉴权拒绝：通知中心留痕 + 可点去设置的出口；加载/空/错误三态由组件内建，不靠文案提醒      |
| 有意义 Meaningful | 视觉强调只留给可操作的东西。选中、hover、焦点、禁用各有唯一一种表达方式，避免强调互相稀释                              | 一个界面只允许一个主行动（primary 按钮不并排两个）；强调靠色彩与描边，不靠加粗字号       |
| 可生长 Growing    | 从单个表单到密集表格到多窗口控制台，同一套刻度与契约都成立——这是「脚手架」而非「页面集合」的定义                       | 新应用 1 个目录 0 处壳层改动（S1）；新组件必须复用同一份 size/status/disabled 契约（S8） |

**Do / Don't（与门禁脚本一一对应，违反即 `npm run check:tokens` 失败）**

- **Do** 间距吸附 4px 网格（命名档 `2xs/xs/sm/md/lg/xl/2xl`）；**Don't** 用小数档（`p-1.5`=6px、`py-0.5`=2px）——它们不在网格上。
- **Do** 圆角按组件类别取档（控件 `rounded-control`、表面 `rounded-surface`、窗口 `rounded-panel`）；**Don't** 让相邻元素混半径——`rounded-panel` 的窗口体里不应出现 `rounded-dock` 的按钮。
- **Do** 颜色一律读语义 token；**Don't** 硬编码 `#fff` / `rgba(...)`——hex 只是巧合，角色才是本体。
- **Do** 用 `font-regular(400)` / `font-strong(600)` 两档；**Don't** 用 `font-medium`、`font-bold` 或斜体制造层级——层级靠字号、颜色与描边。
- **Do** 焦点走全局 `:focus-visible` 环；**Don't** 写 `outline-none` 把键盘用户的路标抹掉。
- **Do** 禁用态写 `disabled:is-disabled`；**Don't** 各组件自己 `disabled:opacity-40`。
- **Do** 时长走 `duration-quick/base/slow`、缓动走 `ease-out/in/in-out/out-back`；**Don't** 随手写 `cubic-bezier(...)` 和 `duration-[137ms]`。
- **Do** 层级用刻度名（`z-desktop/window/panel/toast/overlay/float/shell`）；**Don't** 用 `z-[9999]` 互相压层。
- **Do** 预设色（文件类型色、tint 磁贴）只用于分类信息；**Don't** 为一个新界面临时造一个强调色——那通常说明布局该改，而不是缺色。
- **Don't** 用「等待确认」的死态：任何失败/受限都必须给可操作出口（重试、去设置、返回）。

### 3.1 三层消费模型

```text
token（styles/tokens.css 的 CSS 变量 + Tailwind @theme 映射）
  → 基础组件（src/ui，只准消费 token 派生类）
    → 壳层 / 应用（只准组合基础组件与 token 派生类）
```

**消费规则（硬约束）**

1. 源码中禁止散落色值（`bg-[#ff5f57]`、`rgba(...)`）与魔法时长（`duration-[137ms]`）；新增视觉值先进 token 表。
2. 允许 Tailwind 原语义类的例外：①中性面（`bg-slate-50/100/200`、`border-slate-200` 等）；②应用品牌色（AI 助手 violet、应用中心 indigo、manifest.tint 磁贴渐变）——这类 per-app 身份色不进系统 token。同类视觉在全仓只允许一种写法。
3. 改 token 值全仓生效即为预期行为；需要局部特异视觉时走 variant/props，不复制样式。

### 3.2 WebOS 视觉语言（现状固化为规范）

| 语言      | 定义                                                           | 落点                   |
| --------- | -------------------------------------------------------------- | ---------------------- |
| 玻璃材质  | 半透明白 + `backdrop-blur-xl` + 白描边（/30~/60）              | 顶栏、Dock、窗口、弹层 |
| 交通灯    | 三色圆钮 12px：关闭 #ff5f57 / 最小化 #febc2e / 最大化 #28c840  | 窗口标题栏             |
| tint 磁贴 | 48px 圆角磁贴 + Tailwind 渐变（manifest.tint）+ 内嵌白色线图标 | Dock、应用中心         |
| 活跃态    | 活动窗口对比度高于非活动（白 /85 + 重阴影 vs /70 + 轻阴影）    | 窗口、标题栏           |
| 线性图标  | lucide-vue-next，一律经 `OsIcon` 出口                          | 全仓                   |

### 3.3 token 清单

色彩（CSS 变量，`@theme` 映射为工具类）：

| token                                                     | 值                                                                    | 用途                                                                                    |
| --------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `--color-glass-strong` / `base` / `raise` / `bar` / `pop` | 白 0.85 / 0.70 / 0.45 / 0.28 / 0.92                                   | 活动窗口体 / 非活动窗口体与活动标题栏 / hover 与非活动标题栏 / 顶栏·Dock·Widgets / 弹层 |
| `--color-glass-border` / `glass-border-active`            | 白 0.40 / 0.60                                                        | 常规玻璃描边 / 活动窗口与弹层描边                                                       |
| `--color-ink-strong` / `ink` / `ink-mute`                 | slate-800 / 700 / 400                                                 | 文本三级（标题 / 正文 / 辅助）                                                          |
| `--color-accent` / `accent-strong` / `accent-soft`        | sky-500 / 700 / 100                                                   | 主强调（按钮 / 选中文字 / 选中底）                                                      |
| `--color-danger` / `warning` / `success`                  | rose-500 / amber-500 / emerald-500                                    | 语义                                                                                    |
| `--color-traffic-close/min/max`                           | #ff5f57 / #febc2e / #28c840                                           | 交通灯                                                                                  |
| `--color-file-dir/docx/xlsx/pptx/pdf/other`               | amber-500 / sky-500 / emerald-500 / orange-500 / rose-500 / slate-400 | 文件类型（唯一允许的彩色例外），工具类 `text-file-*`                                    |

圆角与阴影/动效/字号的具体刻度见 3.4；下表只列「角色 → 值」。

| 角色               | 值                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 控件圆角           | `rounded-control` 6px                                                                                                                     |
| 表面（卡片/弹层）  | `rounded-surface` 8px                                                                                                                     |
| 窗口体 / Dock·磁贴 | `rounded-panel` 12px / `rounded-dock` 16px                                                                                                |
| 阴影分层           | `shadow-raise`（轻抬升）/ `shadow-window`（活动）/ `shadow-window-dim`（非活动）/ `shadow-pop`（弹层）/ `shadow-dock`                     |
| 动效               | `duration-quick` 120ms / `base` 180ms / `slow` 260ms；缓动 `ease-out`/`ease-in`/`ease-in-out`/`ease-out-back`。窗口开合 = base + ease-out |
| 字号               | `text-micro` 10 / `caption` 12 / `ui` 13（正文）/ `title` 14 / `heading-3` 14·22 / `heading-2` 16·24 / `heading-1` 20·28                  |

### 3.4 刻度体系（S7 落地）

本节把「有颜色 token」升级为「有刻度体系」。所有刻度定义在 `src/styles/tokens.css`（`@theme` + 一处派生公式 + `@utility`），`theme-light.css` / `theme-dark.css` **只放 seed 与混合锚点**，不放规则。

| 维度   | 刻度                                                                                                                | 说明                                                                                                                                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 间距   | `2xs` 4 / `xs` 8 / `sm` 12 / `md` 16 / `lg` 24 / `xl` 32 / `2xl` 48                                                 | 4px 网格。Tailwind 数字档（`p-3`）因基准是 4px 也合法；**小数档违法**                                                                                                                                                          |
| 圆角   | `chip` 4 / `control` 6 / `surface` 8 / `panel` 12 / `dock` 16 / `full`                                              | 按组件类别而非按数值取档；相邻元素不得混档                                                                                                                                                                                     |
| 字阶   | 正文四档 + `heading-1/2/3`（含行高）                                                                                | 标题档自带 line-height；正文档行高用 `leading-body`(20) / `leading-tight`(18) 显式声明                                                                                                                                         |
| 字重   | `font-regular` 400 / `font-strong` 600                                                                              | 只有两档。选中/激活的视觉线索来自**色彩与描边**，不是加粗                                                                                                                                                                      |
| 控件高 | `h-control-sm` 24 / `h-control` 28 / `h-control-lg` 32                                                              | Button/Input/Select 同一档位表；并排控件必须等高（桌面密度取 28 而非 antd 的 32）                                                                                                                                              |
| 语义色 | 每个语义 6 级：seed / `hover` / `active` / `bg` / `bg-hover` / `border` / `text`                                    | 由 `color-mix(in oklab, …)` **一处派生**，明暗与 4 套强调色预设只换 seed——`--color-accent-strong`/`-soft` 是 `-text`/`-bg` 的兼容别名                                                                                          |
| 中性   | `fill` / `fill-secondary` / `fill-tertiary` / `fill-quaternary`（alpha）                                            | alpha 而非实色：叠在玻璃或着色表面上仍自然混合（hover 底、选中底、禁用底）                                                                                                                                                     |
| 层级   | `z-desktop` 5 / `z-window` 10 / `z-panel` 900 / `z-toast` 1200 / `z-overlay` 1400 / `z-float` 1600 / `z-shell` 1800 | 窗口层由 `windowManager` 在 desktop 与 panel 之间运行时分配，不再写 `z-[9999]`。相对序按语义重排为「面板 < 吐司 < 遮罩(Spotlight) < 浮层(抽屉/对话框) < 壳层」——对话框应压过 Spotlight 遮罩，与旧的 `9996<9997<9998≈9999` 不同 |
| 焦点   | `--raw-focus-ring` / `--raw-focus-width`，main.css 全局 `:focus-visible` 基线                                       | 组件不再出现 `outline-none`；鼠标点击不套环（用 `:focus-visible` 而非 `:focus`）                                                                                                                                               |
| 禁用   | `disabled:is-disabled`（opacity `.4` + `cursor: not-allowed`）                                                      | 禁用态唯一写法，`--opacity-disabled` 一处可调                                                                                                                                                                                  |
| 阴影   | 几何写在 `--shadow-*`，浓度取 `--raw-shadow-strong/pop/mid/faint/weakest`                                           | 暗色只换浓度即可读出场，不必为暗色另写一套阴影                                                                                                                                                                                 |

**窗口级响应式**：本系统不做视口断点（桌面形态，自适应单位是**窗口**而不是屏幕）。落地方式：

- `WindowFrame` 的应用体挂 `cq-window`（`container-type: inline-size` + `container-name: window`），应用内部据此按窗口宽度变形，与浏览器窗口大小无关。
- 三档变体 `w-narrow`（<480px）/ `w-mid`（480~800）/ `w-wide`（≥800），数值同时以 `--bp-window-narrow/mid` 存在刻度层。**container query 的宽度必须是静态值**（浏览器不接受 `var()`），所以这两个 px 字面量只允许出现在 `tokens.css`，属规范认可的例外。
- 参考实现：data-board 筛选条 `w-44 w-narrow:w-full`——窄窗口下搜索/筛选控件铺满换行。E2E `tests/e2e/container.spec.ts` 把窗口体压到 360px 后断言真的换行铺满。

**刻度变量必须全量落进产物**：`@theme` 写成 `@theme static`。Tailwind 4 默认把未被工具类引用的主题变量摇掉，那样运行时（对比度实测、文档站色板、调试面板）就读不到 `--color-*-bg/-text` 了。代价是 CSS 多约 2KB，换来刻度层可被程序检视。

**语义色派生的实测校准**：`warning-text` 的 seed 占比从与其他语义相同的 76% 压到 64%——琥珀色相本身明度高，76% 时「浅底 + 深字」只有 4.46:1，差 0.04 不过 AA。对比度门禁见 `tests/e2e/contrast.spec.ts`（明暗 × 四套强调色 × 五语义 = 8 条用例，阈值 4.5:1，用 canvas 把 `color-mix`/`oklab` 归一到 sRGB 后按 WCAG 公式算）。

**门禁**：`npm run check:tokens`（`scripts/check-tokens.mjs`）扫描 `src/**.{vue,ts}`，命中「颜色字面量 / 圆角裸档 / 小数间距 / 层级裸值 / outline-none / 禁用自写 opacity / 字重越界 / 字号越界 / 魔法时长与缓动 / 组件内自定义变量 / 调色板类」即失败。已接入 `build:check`、CI 与单测（`tests/unit/tokenAudit.test.ts`，含「真实仓库无违规」这条断言）。

- **例外机制**：行内写 `data-token-allow="理由"`，无理由或理由短于 4 字符不算豁免。用于规范 3.1 的两类例外（中性面、per-app 品牌色）。
- **色板棘轮（ratchet）**：调色板类（`bg-violet-500`、`text-slate-600` 这类 Tailwind 原色阶）按文件+数量存基线，**只减不增**——新增即失败，收敛后用 `node scripts/check-tokens.mjs --update-baseline` 降低基线。这样既守住「不再漂新色值」，又不必一次性重写 per-app 品牌磁贴。

**本阶段推翻的旧决定（回写）**

- 原 3.3 写「圆角不另立 token，直接用 `rounded-md/lg/xl/2xl`」。S7 推翻：数值刻度无法表达「这是控件还是这是窗口」，同屏出现 `rounded-md` 与 `rounded-lg` 时无人知道差别的依据是什么，漂移（`rounded` 与 `rounded-md` 混用）也因此测不出来。改为语义档后，**半径错用可被静态扫描**，且暗色/密度调整只需改一处。旧四档数值（6/8/12/16）原样保留，只是改了名字并补了 `chip`/`full`。
- 原字号四档无行高与标题档；S7 补 `heading-*` 与 `leading-*`，但**不给既有 `text-ui/caption` 等档追设 line-height**——那会整体改变行高（现状接近 `normal`≈1.2，设成 1.5 会把 44px 顶栏等固定高度挤爆），属可控风险而非收益，改为新组件显式声明 leading。

## 4. 基础组件契约（src/ui/）

形态无关、无 store 依赖（store 逻辑留在调用方）；样式只消费 token 派生类。

### 4.1 通用契约（S8）

`src/ui/types.ts` 是全仓控件契约的唯一来源，`src/ui/index.ts` 统一具名导出（组件 + 类型）：

| 类型                                                                                                 | 取值                               | 约束                                                                                                         |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `Size`                                                                                               | `sm` / `md` / `lg`                 | 高度**只能**取 `--control-height-sm/md/lg`（24/28/32），经 `src/ui/internal/control.ts` 映射为 `h-control-*` |
| `Status`                                                                                             | `default` / `error` / `warning`    | 非 default 时描边取语义色 `-text`、状态环取 `-border`，不自造色                                              |
| `CommonProps`                                                                                        | `size?` / `disabled?` / `loading?` | 可交互组件必须全部支持                                                                                       |
| `BadgeStatus`                                                                                        | `Status` + `success` / `info`      | 只读展示语义，用于 `OsBadge` 的圆点型                                                                        |
| `TableColumn` / `SortOrder` / `FormField` / `FieldType` / `SelectOption` / `TabItem` / `RadioOption` | —                                  | 从各 SFC 迁入 `types.ts`，SFC 内保留 re-export，既有 import 不破                                             |

四条跨组件一致性由 `tests/unit/contract-helpers.ts` 的同一组断言跑遍 Input/Select/Checkbox/Radio/Switch/Form（不是每个文件各写一份口径）：

- **size**：单测断言类名令牌；**像素一致性在 `tests/e2e/control-height.spec.ts` 的真实浏览器里断言**——happy-dom 不加载 Tailwind 产物，`getComputedStyle().height` 与 `var(--control-height-*)` 实测都是空串，所以单测不假装量像素。
- **disabled**：必须是 `is-disabled` 唯一写法，且原生控件同时真 `disabled`（不能只掉视觉）。
- **status**：同一状态在不同控件上必须落到同一组语义刻度类。
- **loading**：加载即禁用 + 内联图标，图标位预留等宽，文案不跳动。

`src/ui/internal/ControlShell.vue` 收口 Input/Select 共用的控件外框（尺寸/状态/禁用/loading 指示只在此处派生一次），差异靠 props（`filled` 决定实心面还是透明面）。

### 4.2 组件清单（32 件：`src/ui` 31 件经 `@/ui` 出口，`OsIcon` 在 `src/components`）

按职责分四类；S9 新增件标 ★。

**布局与结构**

| 组件               | 契约                                                                                       | 落点                                                              |
| ------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `OsGrid` ★         | `columns: 1..6（默认 3）; gap: GapSize（默认 md）`                                         | 窗口内多栏；列数按**窗口宽度**（`w-narrow/mid/wide`）降档，非视口 |
| `OsSpace` ★        | `direction: row/column; size: GapSize; align: start/center/end/stretch/baseline; wrap`     | 替代散落的 `flex gap-*` 硬写，间距只走间距刻度                    |
| `OsDivider` ★      | `vertical; dashed`（默认插槽可放内嵌文案）                                                 | 分组分隔，不再手写 `border-t`                                     |
| `OsCard` ★         | `title（或 title 插槽）; extra 插槽; footer 插槽; bordered=true; padded=true`              | data-board 统计概览、gallery 分区                                 |
| `OsDescriptions` ★ | `items: DescriptionItem[]; title; column: 1\|2`；`item.slot` 或 `value-<key>` 插槽自定义值 | 只读详情（窗口/实体属性），与"详情=新建字段的子集"一致            |
| `OsCollapse` ★     | `items: CollapseItem[]; accordion; v-model: string[]`；`header-<key>` / `panel-<key>` 插槽 | settings 高级设置、诊断信息折叠                                   |

**录入**

| 组件              | 契约                                                                                                         | 落点                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `OsButton`        | `variant: primary/ghost/danger; size: sm/md/lg; disabled; loading`                                           | 各应用/文件管理散落按钮                             |
| `OsInput`         | `modelValue; placeholder; size/disabled/status/clearable; prefix/suffix 插槽; @enter/@esc/@clear`            | 对话框输入（Spotlight/AI 输入为定制组合件，不强推） |
| `OsTextarea` ★    | `rows=3; autosize: boolean \| { minRows, maxRows }; showCount; maxLength; placeholder; size/disabled/status` | 长文本录入，计数走 `caption` 字阶                   |
| `OsInputNumber` ★ | `step=1; min; max; precision; placeholder; size/disabled/status; v-model: number \| undefined`               | 阈值/步长类数值，禁用态同时掉原生 `disabled`        |
| `OsSelect`        | `options; placeholder; size/disabled/status; loading`                                                        | 散落自绘下拉                                        |
| `OsSegmented` ★   | `options: SegmentedOption[]（value/label/icon?）; label; size; disabled; block; v-model: string`             | 视图切换（表格/卡片等），替代散落 tab 胶囊          |
| `OsForm`          | `fields: FormField[]; modelValue; @submit`（schema 驱动 + 校验）                                             | 应用内联表单                                        |

**展示**

| 组件             | 契约                                                                                                        | 替换现状                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `OsTypography` ★ | `type: text/title/paragraph/link; strong; status; disabled; ellipsis; rows: 1..4; expandable; href`         | 散落 `text-[13px]` 直写字阶         |
| `OsTag` ★        | `status: BadgeStatus; bordered; closable; icon; @close`（文本走默认插槽）                                   | 状态标签、部门/类型标签             |
| `OsAvatar` ★     | `src \| text \| icon: IconName`（三者取一）`; size: Size`                                                   | file-manager 用户、通知来源         |
| `OsBadge`        | 计数型 `count; max=9` \| 圆点型 `dot; status: BadgeStatus`（两者不混用）                                    | 通知未读角标、状态指示              |
| `OsTable`        | `columns: TableColumn<T>; rows; loading/error/empty 三态; 远端分页排序`                                     | data-board、file-manager            |
| `OsTree` ★       | `data: TreeNode[]; selectable; checkable; loadData; v-model:expandedKeys/selectedKeys/checkedKeys; @select` | file-manager 目录树（VFS 行为不变） |

**壳层与反馈**

| 组件               | 契约                                                                                                           | 替换现状                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `OsIcon`（已收口） | `name: IconName; size; strokeWidth`                                                                            | 全仓图标                     |
| `OsTooltip`        | `text; placement: top/bottom/left/right`                                                                       | 壳层 title 属性替代          |
| `OsDialog`         | `title; confirmText/cancelText; loading; maskClosable=true; @confirm/@cancel`（默认插槽为内容，`v-if` 控显隐） | file-manager 新建/重命名弹窗 |
| `OsTrafficLights`  | `@close/@minimize/@maximize`                                                                                   | 窗口标题栏三钮               |

（其余 `OsCheckbox/OsRadio/OsSwitch/OsPagination/OsSkeleton/OsTabs/OsToast/OsDrawer/OsEmpty` 同源于 `@/ui` 出口。）

受控/非控一条路：`OsCollapse`/`OsTree`/`OsSegmented`/`OsInputNumber`/`OsTextarea` 一律用 `defineModel`，未绑 v-model 时自动退化为内部状态，不写"受控就报错"的分支。

开闭原则：基础组件只通过 props/slot 扩展表现，新场景优先加 variant，不在业务侧复制样式。

## 5. 目录结构增补

```text
src/
  ui/                 # 形态无关基础组件（31 件）
    types.ts          # 通用契约：Size/Status/CommonProps + 数据结构类型（S8/S9）
    index.ts          # 唯一出口（组件 + 类型具名导出，S8）
    internal/         # 不对外暴露的共用件（control.ts 刻度映射、scale.ts 布局刻度、ControlShell 外框）
  components/         # 组合型组件（OsIcon 等，可依赖 ui/）
tests/
  unit/               # Vitest 单测
  e2e/                # Playwright 冒烟
```

## 6. 实施状态

| 项            | 状态                 | 说明                                                                                                                                        |
| ------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 工程规范      | 已完成（2026-10-04） | ESLint flat（vue/ts/prettier 兼容）+ Prettier + husky/lint-staged（lint-staged + type-check 门禁）                                          |
| 单测基建      | 已完成（2026-10-04） | Vitest + happy-dom + @vue/test-utils；45 个用例（windowManager/vfs/notification/icons/layout/ui 契约）                                      |
| E2E 冒烟      | 已完成（2026-10-04） | Playwright chromium 6 条冒烟（壳层/Dock 语义/交通灯/拖拽/Spotlight/布局刷新还原），替代手工点测                                             |
| CI 门禁       | 已完成（2026-10-04） | `.github/workflows/ci.yml`：type-check → lint → unit → e2e；仓库暂无远端，CI 未实跑过，待首次 push 验证                                     |
| 设计 token 化 | 已完成（2026-10-04） | `src/styles/tokens.css`（Tailwind `@theme`）；全仓硬编码色值/字号/阴影/时长已收敛，computed style 断言验证（玻璃/交通灯/文件类型/字号层级） |
| 基础组件收口  | 已完成（2026-10-04） | `src/ui/` 五个组件落地并被 WindowFrame/TopBar/file-manager 消费，props/emit 契约有单测                                                      |

**实施期对规范的修正（回写此处）**

- 文本三级 token 命名落为 `ink-strong / ink / ink-mute`（避免 `text-text-*` 前缀重复）；吸收原 slate 300/400/500→mute、600/700→ink、800→strong。
- 字号归一产生轻微视觉变化：11px→caption(12)、15px→title(14)，属预期去漂移。
- 圆角不新增 token，直接消费 Tailwind 圆角刻度（原规范草案的 6/8/12/16 与 md/lg/xl/2xl 一致）。
- `tsconfig.vitest.json` 同时覆盖 `tests/unit`、`tests/e2e` 与 `playwright.config.ts` 的类型检查（命名沿用 vitest）。
- OsDialog 不带 `open` prop，由调用方 `v-if` 控显隐（与既有写法一致，避免双状态源）。
