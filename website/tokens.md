# 设计 Token

WebOS 的视觉值全部收敛在三个文件里，组件只消费**刻度名**，永远不写裸值：

```text
刻度层  tokens.css        @theme 定义刻度与语义名 + :root 定义派生公式
原始层  theme-light.css   --raw-*：浅色 seed、中性色、玻璃、混合锚点
        theme-dark.css    --raw-*：深色覆盖（只换 seed 与锚点，公式不动）
```

这样做的结果是三件事同时成立：

1. **加一个语义色不用改 6 处** —— 只写 seed，`hover/active/bg/bg-hover/border/text` 六级由公式派生。
2. **换品牌色只改一行** —— 强调色预设只覆盖 `--raw-accent`，衍生色自动跟随。
3. **切暗色零组件改动** —— 工具类名与派生公式保持稳定，暗色只换原始值。
4. **刻度可被程序检视** —— `@theme` 写成 `@theme static`，Tailwind 不会摇掉未被工具类引用的变量，运行时（对比度实测、色板调试）才读得到 `--color-*-bg/-text`。

::: warning 门禁
`node scripts/check-tokens.mjs`（`npm run check:tokens`，已挂 CI 与 `build:check`）按 10 条规则扫描全仓：裸色值、圆角档位、间距吸附 4px 网格、层级刻度、焦点可见、禁用浓度、字重、字阶、魔法时长/缓动、裸 `--raw-*` 消费。违规即挡合并。详见 [刻度层之下的「门禁」](#门禁与例外)。
:::

## 刻度速查

### 间距

4px 网格七级，**禁用 Tailwind 小数档**（`p-1.5` = 6px 不在网格上）：

| Token | 值   | 典型用途                     |
| ----- | ---- | ---------------------------- |
| `2xs` | 4px  | 图标与文字之间、徽标内边距   |
| `xs`  | 8px  | 同组控件间距、紧凑卡片内边距 |
| `sm`  | 12px | 表单行距、列表项内边距       |
| `md`  | 16px | 缺省卡片内边距、区块间距     |
| `lg`  | 24px | 应用主区内边距               |
| `xl`  | 32px | 区域分隔                     |
| `2xl` | 48px | 页面级留白                   |

工具类走 Tailwind 的 spacing 命名空间，`p-md` / `gap-sm` / `my-lg` 直接可用。

### 圆角

按**组件类别**分档，不按尺寸分档；相邻元素不得混档（如 8px 卡片里放 16px 按钮）：

| Token     | 值     | 用在                             |
| --------- | ------ | -------------------------------- |
| `chip`    | 4px    | 标签、徽标、提示气泡             |
| `control` | 6px    | 按钮、输入、选择、分页项         |
| `surface` | 8px    | 卡片、对话框、抽屉、通知         |
| `panel`   | 12px   | 窗口体                           |
| `dock`    | 16px   | Dock、Widgets、tint 磁贴         |
| `full`    | 9999px | 圆点、头像（**禁用于控件本体**） |

### 字阶与字重

| Token       | 字号 / 行高 | 用途                             |
| ----------- | ----------- | -------------------------------- |
| `micro`     | 10px        | 角标数字                         |
| `caption`   | 12px        | 辅助说明、时间戳                 |
| `ui`        | 13px        | 正文 UI（表格、菜单、列表）      |
| `title`     | 14px        | 标题、输入框                     |
| `heading-3` | 14 / 22px   | 区块小标题                       |
| `heading-2` | 16 / 24px   | 应用内页标题                     |
| `heading-1` | 20 / 28px   | 应用主标题                       |
| `display-3` | 24 / 32px   | 磁贴名、时钟                     |
| `display-2` | 36 / 44px   | 桌面标语                         |
| `display-1` | 48 / 56px   | 刻度上限，仅空态数字这类大屏展示 |

字重只有两档：`font-regular`（400）与 `font-strong`（600）。**强调靠色彩与描边，不靠更粗的字重**；`font-medium` / `font-bold` 一律被门禁拒绝。

### 控件高度

同一行并排的控件必须等高，用高度档而不是 padding 撑：

| Token          | 值   | 用途                 |
| -------------- | ---- | -------------------- |
| `h-control-sm` | 24px | 表格内联、工具条     |
| `h-control`    | 28px | 缺省（表单、对话框） |
| `h-control-lg` | 32px | 主行动按钮           |

### 语义色六级

每个语义（`accent` / `danger` / `warning` / `success`，`info` 跟随 `accent`）都有六级，一个 seed 派生其余：

| 级         | 工具类示例             | 用在哪                         |
| ---------- | ---------------------- | ------------------------------ |
| seed       | `bg-danger`            | 实心按钮、图标主色             |
| `hover`    | `bg-danger-hover`      | 悬停                           |
| `active`   | `bg-danger-active`     | 按下                           |
| `bg`       | `bg-danger-bg`         | 浅底：告警条、选中行、标签底   |
| `bg-hover` | `bg-danger-bg-hover`   | 浅底之上悬停                   |
| `border`   | `border-danger-border` | 描边版本                       |
| `text`     | `text-danger-text`     | 浅底上的强调文字（保证对比度） |

派生公式集中在 `tokens.css` 的 `:root`，只依赖四个**混合锚点**：

| 锚点                | 浅色主题 | 深色主题 | 控制什么            |
| ------------------- | -------- | -------- | ------------------- |
| `--raw-mix-base`    | 白       | 容器面   | `bg` / `border` 底  |
| `--raw-mix-lighten` | 白       | 白       | `hover` 提亮方向    |
| `--raw-mix-darken`  | 黑       | 黑       | `active` 压暗方向   |
| `--raw-mix-ink`     | 黑       | 白       | `text` 走向哪个明度 |

::: tip 兼容名
`--color-accent-strong` = `-text`，`--color-accent-soft` = `-bg`。S6 之前的代码在用，新代码一律用六级名；S8 组件契约统一时收敛掉。
:::

### 中性填充四档

`fill` / `fill-secondary` / `fill-tertiary` / `fill-quaternary` 是 alpha 灰，叠在任何着色表面上都能自然混合，用于 hover 底、分隔块、占位块——不要为这类场景新造 `bg-slate-*`。

### 层级

Tailwind 4 没有 z-index 的 `@theme` 命名空间，所以用 `@utility` 提供 `z-*`：

| Token       | 值   | 归属                 |
| ----------- | ---- | -------------------- |
| `z-desktop` | 5    | Widgets 等桌面件     |
| `z-window`  | 10   | 窗口层基值           |
| `z-panel`   | 900  | 右键菜单、下拉、气泡 |
| `z-toast`   | 1200 | 吐司                 |
| `z-overlay` | 1400 | Spotlight、遮罩      |
| `z-float`   | 1600 | 抽屉、对话框浮层     |
| `z-shell`   | 1800 | 顶栏、Dock           |

窗口层内的具体层级由 `windowManager` 在 `z-desktop` 与 `z-panel` 之间运行时分配，所以组件里写 `z-[9999]` 之类一定错——它绕过整个刻度。

### 动效

三档时长 + 四个具名缓动，禁止随手写 `cubic-bezier` 与 `duration-[137ms]`：

| 时长    | 值    | 用于                     |
| ------- | ----- | ------------------------ |
| `quick` | 120ms | hover、按下、图标状态    |
| `base`  | 180ms | 窗口开合、抽屉、折叠     |
| `slow`  | 260ms | 大面积布局变化、主题切换 |

缓动：`ease-out`（入场/减速，窗口打开）、`ease-in`（出场，窗口关闭）、`ease-in-out`（往复）、`ease-out-back`（轻微回弹，徽标/磁贴）。

### 阴影

几何写死在刻度层，浓度由 `--raw-shadow-*` 分层，因此明暗自动适配：

| Token               | 用途               |
| ------------------- | ------------------ |
| `shadow-raise`      | 卡片轻抬升         |
| `shadow-window`     | 活动窗口           |
| `shadow-window-dim` | 非活动窗口         |
| `shadow-pop`        | 弹层（下拉、气泡） |
| `shadow-dock`       | Dock、Widgets      |

## 窗口级响应式

桌面形态没有页面跳转，自适应的单位是**窗口**而不是浏览器视口，所以本系统**不做视口断点**，用 CSS container query：

- `WindowFrame` 的应用体挂 `cq-window`（`container-type: inline-size` + 名为 `window` 的容器）。
- 应用内部用三档变体变形：`w-narrow`（窗口 < 480px）/ `w-mid`（480~800）/ `w-wide`（≥ 800）。
- 参考实现是 data-board 的筛选条：`w-44 w-narrow:w-full`——窗口一窄，搜索与筛选控件铺满并换行。

::: warning px 字面量为何允许
container query 的宽度必须是静态值，浏览器不接受 `var()`。所以 `480px / 800px` 这两个字面量**只允许出现在 `tokens.css`**（同时以 `--bp-window-narrow/mid` 存在，供运行时读取），别处再写一个就算漂移。
:::

## 状态规范

| 状态 | 唯一写法                                                                           | 说明                                                                       |
| ---- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 焦点 | 根上全局 `:focus-visible` 环（2px，accent 45% alpha，offset 2px）                  | 组件**不得**写 `outline-none`；需要自定义环时用 `--raw-focus-*` 而不是删掉 |
| 禁用 | `is-disabled` 工具类（`opacity: var(--opacity-disabled)` + `cursor: not-allowed`） | 禁用浓度只有一个值 0.4，不要写 `disabled:opacity-50`                       |
| 加载 | 组件内建 `loading`（S10 补 `OsSpin` 后统一）                                       | —                                                                          |

焦点规则用 `main.css` 的 `@layer base` 实现，所以任何控件不需要单独声明就有键盘焦点环；鼠标点击不套环（`:focus-visible` 的浏览器语义）。E2E 里 `tests/e2e/focus.spec.ts` 实测 Tab 落点、⌘K 后的输入框、鼠标点击三种情形。

## 对比度实测

「浅底 `bg` + 深字 `text`」是 Alert / 选中行 / 标签这类场景的主用法，对比度不能靠肉眼。`tests/e2e/contrast.spec.ts` 在**明暗 × 四套强调色 × 五语义 = 8 条用例**里用 canvas 把 `color-mix`/`oklab` 归一到 sRGB，按 WCAG 公式算比值，阈值 4.5:1（AA 正文）。

这条门禁已经改过一次刻度：`warning-text` 的 seed 占比从与其他语义一致的 76% 压到 64%——琥珀色相明度高，76% 时只有 4.46:1，差 0.04 不过线。**这就是派生公式集中定义的好处**：改一个百分数，四个预设两套主题一起跟上。

## 主题切换 API

`theme` store（`kernel/stores/theme.ts`）：

```ts
state: { wallpaper, mode: 'light' | 'dark', accent: 'sky' | 'violet' | 'emerald' | 'rose' }
```

- `setMode(mode)` / `toggleMode()` / `setAccent(key)` / `cycleWallpaper()`
- `apply()` 把 `mode` / `accent` 写到 `document.documentElement.dataset`，CSS 据此换 `--raw-*`。
- 持久化键 `theme-v1`，带 `THEME_VERSION=2` 与迁移（旧数据只有 wallpaper 时可读，mode/accent 回落默认）。

CSS 侧的加载顺序是刻意的：`theme-dark.css` 在 `theme-light.css` 之后引入，使 `:root[data-theme='dark']` 与 `[data-accent='*']` 预设靠**顺序 + 特异度**共同决定结果——暗色下的强调色预设写在 `theme-dark.css` 里，用更高特异度压过浅色预设。

## 门禁与例外

`scripts/check-tokens.mjs` 的十类规则 id：

```text
color-literal      裸 hex / rgb() / rgba()
radius-scale       非语义档圆角
off-grid-spacing   非 4px 网格间距
z-literal          裸 z-index
focus-hidden       outline-none / focus:outline-none
disabled-opacity   非刻度禁用浓度
font-weight        非 400/600 字重
font-size          非字阶刻度字号
magic-motion       魔法时长与随手写的 cubic-bezier
raw-var            组件直接消费 --raw-*
palette-class      Tailwind 原色阶（棘轮规则，见下）
```

两类例外机制：

1. **行内豁免** `data-token-allow="理由"`：写在元素属性上，理由超过 3 字符才算数，用于确实合理的个案（如用户壁纸的内联色）。
2. **棘轮基线** `scripts/token-baseline.json`：`palette-class` 是唯一按「文件 + 数量」存基线的规则——per-app 品牌色（AI 助手 violet、应用中心 indigo、`manifest.tint` 磁贴渐变）与中性面是规范允许的例外，但**只减不增**。收敛后跑 `node scripts/check-tokens.mjs --update-baseline` 降低基线。
