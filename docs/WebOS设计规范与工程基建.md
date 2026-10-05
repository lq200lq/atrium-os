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
docs:dev / docs:build / docs:gen / docs:check / docs:preview / docs:embed
```

**文档站同源嵌入链（`docs:embed`）**：VitePress 的 `base` 定为 `/docs/`，`scripts/embed-docs.mjs` 把它构建进 `website/.vitepress/dist` 后整份复制到 `public/docs/`（gitignore 的构建产物）。选「复制静态产物」而不是代理另一个 dev 端口，是因为 `public/` 由 Vite 静态服务，dev / `vite preview` / `dist/` 三处同源可达且零新依赖；代价是**改文档要重跑一次 `docs:embed`，没有 HMR**（写作时仍用 `docs:dev`，它同样挂在 `/docs/`）。脚本总是重建 dist——曾按「dist 已存在就跳过」写过，结果拷到了一份旧 base 的产物，坑就写在这里。`pretest:e2e` 带 `--if-missing`，本地反复跑 E2E 不会被文档构建拖慢，CI 是干净克隆故必然实跑。

> 一个只有实测才能发现的边界：Vite dev 的 SPA fallback 会把**未知路径**落回本应用 `index.html`，所以同源入口必须写 `/docs/index.html` 这类带扩展名的真文件路径；`/docs/tokens` 这种无扩展名深链在 dev 下拿到的是 WebOS 壳层本身。iframe 里出现壳层就是「壳套壳」，因此壳层启动时判断 `window.self !== window.top` 拒绝在 frame 内挂载（见《WebOS应用开发指南.md》§6）。

### 2.2 提交规范

- 中文单行「类型：描述」：`feat：…` / `fix：…` / `refactor：…` / `test：…` / `docs：…` / `chore：…`
- 一个 commit 只装一条工作线；逐文件名 `git add`，禁止 `git add -A`
- 不替并行工作线提交 WIP
- **S12 起由 `commitlint` 机器兜住**：`commitlint.config.mjs` + `.husky/commit-msg`。要点是 `parserPreset.headerPattern` 必须改成按**全角冒号**拆分——conventional-commits-parser 默认只认半角 `:`，不改则本仓所有中文提交都会被判 `type-empty` 全红。`header-max-length` 放宽到 100（中文信息密度高），`subject-case`/`scope-case` 关闭（描述里嵌 `OsAlert` 这类组件名会被误判成大小写违规）。

### 2.3 测试策略

| 层     | 工具                     | 覆盖对象                                                                                                                                                                                  | 不做什么                                     |
| ------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 单元   | Vitest + happy-dom       | store 纯逻辑（windowManager/vfs/icons/notification）、纯函数                                                                                                                              | 不测视觉                                     |
| 组件   | Vitest + @vue/test-utils | 基础组件（src/ui）的 props/emit 契约                                                                                                                                                      | 不测样式渲染像素                             |
| E2E    | Playwright               | 按主题拆分的 spec（壳层/窗口/权限/数据/组件/主题/可观测…）                                                                                                                                | 不穷举交互                                   |
| 无障碍 | Playwright + axe-core    | `a11y.spec.ts` 13 次 axe 扫描（壳层 / Spotlight / 陈列 7 页签 / 设置 / 网页应用面板与弹窗 / embed 窗口）serious/critical 必须为 0；`keyboard.spec.ts` 键盘契约；`contrast.spec.ts` 对比度 | 不做 AA 之外的全量 WCAG 打分                 |
| 视觉   | Playwright 截图基线      | `visual.spec.ts` 10 张组件级基线（壳层明暗 / Spotlight / 陈列窗口 7 页签）随仓库提交，CI 比对                                                                                             | 不做全页面像素回归（噪声大，见规划 §8 定案） |

覆盖率下限自 S12 起按目录分档（`vitest.config.ts`）：全局 75/72/78/78（stmts/branch/funcs/lines）之外，另设 `src/ui/**` 85/78/85/88 与 `src/kernel/**` 65/58/70/68 两块地板。分档而不是一刀切全局，是因为 `windows`/`i18n` 的覆盖结构与组件层不同，混在一个全局阈值里只会把地板架空。

**跨源 frame 的断言口径（D2′ 外部网页应用）**：iframe 里是别人的文档，选择器与 axe 都进不去，因此「内容真的渲染了」这一条只能对**同源页面**断言。测试用 `public/embed-demo.html`（唯一的同源嵌入样本，纯静态文件，不是 mock server）配合 `page.frameLocator()` 拿到真信号；第三方站点只断言我们自己的 embed chrome（工具条、超时 warning、重试、新标签页出口）。axe 会**下钻同源 iframe**，所以无障碍场景只覆盖管理面板 + embed chrome + 同源 fixture，不把文档站正文纳入扫描面——VitePress 自有页面的问题该由文档站自己修，不该让壳层门禁继承一份不属于它的红。

**扫描前等窗口过渡收尾**：axe 的对比度取的是即时计算样式，玻璃层入场动画跑到一半时背景被混淡，读数会漂移（`settings` 场景曾偶发 `color-contrast 4.15:1`，单独重跑又 9/9 全绿——典型的「门禁自己不稳定」而不是「产品有红」）。`scan()` 因此先 `waitForFunction` 到页面上不再有 `.win-enter-active/.win-leave-active` 再分析；这不是给断言放水，`animations: 'disabled'` 只管截图，管不到 axe。

**就绪屏障收进 `gotoShell()`**：S10 记过一次同类竞态（`⌘K` 监听挂在 `App.vue` 的 `onMounted`，而 `goto()` 在 `load` 就返回，按键可能早于监听注册），当时只在 `shell.spec.ts` 一处补了屏障。D2′ 新增的 a11y Spotlight 场景又红了一次——它是按用例逐个 `gotoShell()` 的文件，绕过了那处局部屏障。根因只有一个，所以修在共用入口：`helpers.ts` 的 `gotoShell()` 现在 `goto()` 后固定 `expect(getByRole('banner')).toBeVisible()`，所有 spec（含 `page.reload()` 后走自动重试定位的用例）一并受益，没有屏障的老写法留着也不冲突——它只是重复了一次同一个等待。修完连跑 4 轮全套 83 条全绿。

### 2.4 CI

`ci.yml` 三个 job，任一失败即挡合并：

| job      | 内容                                                                                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check`  | install → `type-check` → `lint` → `format:check` → `check:tokens` → `test:unit:coverage` → E2E（`--grep-invert "a11y\|visual"`）→ `build:check` → `docs:build` |
| `a11y`   | `test:e2e:a11y`（axe 13 次扫描 + 键盘契约），独立红                                                                                                            |
| `visual` | `test:e2e:visual` 截图 diff；缺本平台基线时先跑 `--update-snapshots` 并把产物上传为 `visual-baselines-linux`，提交后转为真正的 diff 门禁                       |

截图基线按平台分目录（`snapshotPathTemplate` 里的 `{platform}`）：字体栅格化与抗锯齿跨 OS 不可比，同 OS 的 diff 才是有效门禁，所以 darwin 基线守护本地开发、linux 基线由 CI 首跑引导生成。

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

### 4.2 组件清单（42 件：`src/ui` 41 件经 `@/ui` 出口，`OsIcon` 在 `src/components`）

按职责分五类；S9 新增件标 ★，S10 新增件标 ◎。

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

**导航**

| 组件             | 契约                                                                                                                     | 落点                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `OsMenu` ◎       | `items: MenuItem[]（二级 children）; mode: vertical/horizontal; disabled; v-model:selectedKeys; focusFirst()`            | 下拉浮层内、侧栏命令面板；roving tabindex 键盘导航          |
| `OsDropdown` ◎   | `items: MenuItem[]; trigger: click/hover; placement: Placement; disabled; v-model:open; @click(key)`                     | 内部复用 `OsMenu`，键盘不重抄一遍                           |
| `OsBreadcrumb` ◎ | `items: BreadcrumbItem[]; maxVisibleItems; separator; @click(item)`（根 `<nav aria-label>`，末项 `aria-current="page"`） | file-manager 路径栏（超长折叠复用 `OsDropdown`）            |
| `OsSteps` ◎      | `items: StepItem[]; error; v-model: current; @change(index)`（四态 wait/process/finish/error 由 current 推导）           | 分步流程；`w-narrow` 容器自动退化纵向（无 `vertical` prop） |

**壳层与反馈**

| 组件               | 契约                                                                                                                               | 替换现状                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `OsIcon`（已收口） | `name: IconName; size; strokeWidth`                                                                                                | 全仓图标                                            |
| `OsTooltip`        | `text; placement: top/bottom/left/right`                                                                                           | 壳层 title 属性替代                                 |
| `OsDialog`         | `title; confirmText/cancelText; loading; maskClosable=true; @confirm/@cancel`（默认插槽为内容，`v-if` 控显隐）                     | file-manager 新建/重命名弹窗                        |
| `OsAlert` ◎        | `type: BadgeStatus; message; description; closable; showIcon; banner; @close`（`banner=true` 时 `role=alert`，否则 `role=status`） | settings 诊断说明、表格错误态提示                   |
| `OsSpin` ◎         | `loading; size: Size; tip`（有默认插槽=容器遮罩，无插槽=内联指示器）                                                               | `OsTable` 的 loading 态、局部等待                   |
| `OsProgress` ◎     | `percent; type: line/circle; status: ProgressStatus（缺省由 percent 推导）; strokeWidth; showInfo`                                 | 下载/生成类进度，替代裸宽度条                       |
| `OsResult` ◎       | `status: success/error/403/warning; title; subtitle`（默认插槽=补充内容，`extra` 插槽=下一步出口）                                 | 窗口错误边界（`ErrorBoundary`）、403 落地、设置空态 |
| `OsPopconfirm` ◎   | `title; description; okText/cancelText; placement; disabled; @confirm/@cancel`（浮层 `z-panel`，焦点进确认钮）                     | 表格行/工具栏的轻确认，不为小动作开 `OsDialog`      |
| `OsTrafficLights`  | `@close/@minimize/@maximize`                                                                                                       | 窗口标题栏三钮                                      |

命令式入口不是组件而是 `src/ui/feedback.ts` 的 `useFeedback()`：由壳层 `FeedbackHost` provide 上下文（`notify/success/error/warning/info/confirm`），通知数据仍只有 `useNotification` 一份。未挂宿主时 `useFeedback()` 直接抛错，不退化成模块级单例——避免 `ConfigProvider` 上下文读不到那一类问题在这里重演。

（其余 `OsCheckbox/OsRadio/OsSwitch/OsPagination/OsSkeleton/OsTabs/OsToast/OsDrawer/OsEmpty` 同源于 `@/ui` 出口。）

**作用域配置（S11，`OsConfigProvider`）**：一处配置、局部生效的载体，可套在应用内的任意子树上，聚合三类覆盖——`locale`（组件内建文案的语言）、`size`（componentDefaults，控件缺省档）、`theme`（`accent` 预设 / `controlHeight` / `radius` 刻度）。实现只有两条腿：CSS 变量（写在该子树根 `.os-config` 上，圆角/控件高就近覆盖，强调色只写 `data-accent` 预设名、seed 与六级派生仍只在 `theme-*.css` + `tokens.css` 各写一次）与 `provide/inject`（`config.ts` 的 `useConfig`/`useControlSize`）。**职责边界（规划 §8 已定，这里是权威口径）**：`theme` store 管**全局持久化**设置（写 localStorage、落根元素 `data-*`），Provider 管**子树局部覆盖**且**不写 store**——因此 Provider 的选择刷新即消失、也不越界影响其它窗口；两者不存在同一份状态的双写。尺寸决议收敛在一处：`useControlSize(() => props.size)`（显式 prop > 作用域缺省 > `md`），组件不再各自写 `?? 'md'`；`ControlShell` 消费它，所以整个输入族自动获得作用域尺寸。

**宽度刻度（S11 补）**：`max-w-*` **禁用 Tailwind 具名档**（`max-w-md`/`max-w-lg`…）。本仓库 `@theme` 的六级 `--spacing-*` 会让 Tailwind 4 把 `max-w-md` 解析成 `var(--spacing-md)`（16px）而不是它自己的 `--container-md`，实测把顶栏搜索胶囊压成 34px。可读宽度一律走 `--container-md: 448px` / `--container-lg: 512px` 两档，写法固定为 `max-w-[var(--container-md)]`，把绑定关系显式写在类名里。`w-2xl`/`h-2xl` 这类**方框尺寸**绑到 `--spacing-2xl`（48px）是有意用法，保留。

**组件内建文案（S11）**：基础组件的自带文案（「暂无数据」「确定」「上一页」`select` 占位…）一律经 `src/ui/internal/text.ts` 的 `useText()` 取词——作用域内有 `locale` 就按该语言解析，否则回退全局 i18n（仍响应式）。业务应用不受此约束，继续直接用 vue-i18n 的 `t`。全库唯一一处写死中文的 `OsSelect` 占位 `'请选择'` 已改为 `common.selectPlaceholder`，并补了 `ariaLabel` 契约（原生 `select` 没有可见 label，axe 的 `select-name` 由此在源头解决）。

**图标白名单（S11）**：`kernel/icons.ts` 的 `ICON_MAP` 仍是显式子集（`IconName` 因此保持字面量联合，写错名字在 `vue-tsc` 就红），但不再手写：`npm run icons:gen` 扫描 `src/` 的用点（静态 `name="…"` 与 `icon: '…'`）补齐 import 与映射，`--check` 模式已挂进 `build:check`——用了未登记图标即 CI 失败并提示跑生成命令。规划里「改全量动态解析」的路线经实测否决：单文件探针 `import * as lucide` 产出 583KB（未拆包、minify 后），同时打爆 vendor 单块 260KB 上限与首屏 700KB 预算，且 `lucide-vue-next@0.577` 根本没有 `DynamicIcon`；现状 26 个图标只占 vendor 7.9KB。

受控/非控一条路：`OsCollapse`/`OsTree`/`OsSegmented`/`OsInputNumber`/`OsTextarea` 一律用 `defineModel`，未绑 v-model 时自动退化为内部状态，不写"受控就报错"的分支。

开闭原则：基础组件只通过 props/slot 扩展表现，新场景优先加 variant，不在业务侧复制样式。

**键盘与焦点规范（S12 成文）**：这一类行为在 S11 之前只散落在个别组件里，现在定为契约，验收在 `tests/e2e/keyboard.spec.ts`（6 条）+ `tests/e2e/focus.spec.ts`（4 条）+ `tests/e2e/a11y.spec.ts`（axe 13 次扫描 + 降级一条）。

| 条目     | 规范                                                                                                                                                                                          | 落点                                                                        |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 焦点可见 | 键盘焦点一律走 token 环：`--raw-focus-width`（2px）+ `--raw-focus-ring`（accent 45% 混合），由 `main.css` 的 `:focus-visible` 一处定义；组件不得再写 `outline-none` 自废                      | `focus.spec.ts` 断言每一站 ≥2px 实线，且鼠标点击不套环                      |
| Tab 顺序 | 与 DOM 顺序一致，不加正/负 `tabindex` 插队：壳层为顶栏 → 桌面 → Dock                                                                                                                          | `keyboard.spec.ts`「纯 Tab 可达」                                           |
| Esc 退出 | 每个浮层都必须能从键盘原路退出：`OsDialog`→`@cancel`、`OsDrawer`→`@close`（S12 补）、`OsDropdown`/`OsPopconfirm`→内部 hide、Spotlight/通知中心→`closeOverlays()`                              | 对话框、抽屉、Spotlight 三条 E2E                                            |
| 焦点归还 | 浮层关闭后焦点必须回到打开它的元素（记住 `document.activeElement`，卸载/关闭时 `focus()`，节点已消失则不动）。没有这条，键盘用户每关一次浮层就要从页头重新 Tab 一遍                           | `OsDialog.onBeforeUnmount` / `OsDrawer` 的 `watch(open)` / `Spotlight` 同构 |
| 唤起键   | `⌘K`/`Ctrl+K` 是**开合开关**而不是只开有关（否则键盘用户无法用同一键位退出）                                                                                                                  | `App.vue` 的全局 keydown                                                    |
| 方向键   | 列表型浮层用 `aria-current="true"` 标活动项（Spotlight 结果），树型结构支持上下移动 + 回车展开/选中（`OsTree`）                                                                               | `keyboard.spec.ts`、`tree.spec.ts`                                          |
| 可访问名 | 无可见 label 的原生控件必须有名：录入族（`OsInput/OsInputNumber/OsTextarea/OsSelect/OsCheckbox`）走 `ariaLabel` 契约，`OsTree` 复选框取节点名，图标按钮（顶栏铃铛等）取 `aria-label`          | axe `label`/`button-name`/`select-name` 在各扫描场景均为 0                  |
| 动效降级 | `prefers-reduced-motion: reduce` 下时长统一压到 `--duration-reduced`（0.01ms）并取消入场位移，但**状态切换本身照常发生**——Vue 的 Transition 靠 `transitionend` 判定结束，降级不能把它一起关掉 | `a11y.spec.ts` 降级用例（窗口能开也能关 + 时长实测 ≤1ms）                   |

未做（诚实记录，不在 S12 范围内）：浮层的**焦点陷阱**（Tab 循环锁在浮层内）与打开时自动聚焦首个可交互元素。`OsDialog`/`OsDrawer` 已声明 `aria-modal="true"`，但辅助技术之外，纯键盘仍可 Tab 到浮层背后的桌面元素。补这条要先定「谁负责 trap」（组件 vs 壳层），单独立项。

## 5. 目录结构增补

```text
src/
  ui/                 # 形态无关基础组件（41 件）
    types.ts          # 通用契约：Size/Status/CommonProps + 数据结构类型（S8/S9/S10）
    index.ts          # 唯一出口（组件 + 类型具名导出，S8）
    config.ts         # 作用域配置契约：OsConfig/useConfig/useControlSize（S11）
    feedback.ts       # 命令式反馈契约层（useFeedback/provideFeedback，S10）
    internal/         # 不对外暴露的共用件（control.ts 刻度映射、scale.ts 布局刻度、placement.ts 浮层定位、level.ts 分级配色/图标、text.ts 作用域取词（S11）、ControlShell 外框）
  components/         # 组合型组件（OsIcon 等，可依赖 ui/）
  windows/            # 窗口 chrome：WindowFrame/WindowManager/ErrorBoundary + EmbedView（外部网页应用内容区）
  kernel/
    webapp/           # url.ts：外部应用地址校验归一（用户输入的安全边界，纯函数）
    stores/           # windowManager/appRegistry/webApps/vfs/theme/session/settings/notification/icons
public/               # Vite 静态目录：embed-demo.html（同源嵌入样本）、docs/（docs:embed 产物，gitignore）
tests/
  unit/               # Vitest 单测
  e2e/                # Playwright 冒烟
```

**`EmbedView` 为什么不在 `src/ui`**：它不是可复用 UI 原语，而是窗口内容区的一种实现——靠 `useWindowContext()` 反查所属窗口的 `manifest.embed`，只在 `appRegistry.register()` 合成组件时被用到。放进 `src/ui` 会让它进组件清单与 API 表生成面（`gen-api-tables` 扫 `src/ui/*.vue`），对外暴露一个「请不要再处开 iframe」的件；边界留在 `src/windows`，`src/ui` 的 API 面继续只装形态无关组件。

**`src/ui` 的边界（S10 收尾定案，暂不拆包）**：对外只有 `@/ui` 这一个 API 面——`internal/*` 只允许 `src/ui` 自身引用，`check-tokens` 之外靠 review 守；业务应用按件路径（`@/ui/OsCard.vue`）引入是**包体预算**决定（单个应用平均只用 4~6 件，走 barrel 会把整包拉进首屏，见规划 §9 S9 修正条），不是第二套 API。是否独立发包（monorepo）等 S11 的 `OsConfigProvider` 把 API 面稳定后再评估——S11 已交付该件，API 面（组件 props + `config.ts` 契约 + `@/ui` 出口）至此稳定，结论仍是**维持单仓**：拆包只解决分发问题，本仓库的分包收益由 `manualChunks` 与包体预算门禁拿到（见规划 §8 定案）。

## 6. 实施状态

> 下表数字是 **S1~S6 打底完成时（2026-10-04）的基线快照**，不作为现状读数。当前组件数见 §4.2，各阶段增量与实测数（单测/E2E/包体）见《WebOS对标AntDesign迭代规划.md》§9。

| 项            | 状态                 | 说明                                                                                                                                                                                                                           |
| ------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 工程规范      | 已完成（2026-10-04） | ESLint flat（vue/ts/prettier 兼容）+ Prettier + husky/lint-staged（lint-staged + type-check 门禁）                                                                                                                             |
| 单测基建      | 已完成（2026-10-04） | Vitest + happy-dom + @vue/test-utils；45 个用例（windowManager/vfs/notification/icons/layout/ui 契约）                                                                                                                         |
| E2E 冒烟      | 已完成（2026-10-04） | Playwright chromium 6 条冒烟（壳层/Dock 语义/交通灯/拖拽/Spotlight/布局刷新还原），替代手工点测                                                                                                                                |
| CI 门禁       | 已完成（2026-10-04） | `.github/workflows/ci.yml`：type-check → lint → unit → e2e；仓库暂无远端，CI 未实跑过，待首次 push 验证                                                                                                                        |
| 设计 token 化 | 已完成（2026-10-04） | `src/styles/tokens.css`（Tailwind `@theme`）；全仓硬编码色值/字号/阴影/时长已收敛，computed style 断言验证（玻璃/交通灯/文件类型/字号层级）                                                                                    |
| 基础组件收口  | 已完成（2026-10-04） | `src/ui/` 五个组件落地并被 WindowFrame/TopBar/file-manager 消费，props/emit 契约有单测                                                                                                                                         |
| 无障碍门禁    | 已完成（2026-10-05） | axe 13 次扫描 serious/critical = 0（`BASELINE` 空表，只减不增；D2′ 另加网页应用三场景，扫描前统一等窗口过渡收尾，壳层就绪屏障收进 `gotoShell()`）+ 键盘/焦点契约 10 条 + 对比度含暗色×4 预设与中性 `ink-mute`/`on-accent` 盲区 |
| 视觉回归基线  | 已完成（2026-10-05） | `visual.spec.ts` 10 张组件级基线随仓库提交（`darwin/`），时钟冻结 + `reducedMotion` + `animations:'disabled'` 三处钉死不确定项，CI 独立 job 比对                                                                               |
| 提交信息门禁  | 已完成（2026-10-05） | `commitlint` + `.husky/commit-msg`：中文全角冒号「类型：描述」，半角与自由文本实测被挡（exit=1）                                                                                                                               |

**实施期对规范的修正（回写此处）**

- 文本三级 token 命名落为 `ink-strong / ink / ink-mute`（避免 `text-text-*` 前缀重复）；吸收原 slate 300/400/500→mute、600/700→ink、800→strong。
- 字号归一产生轻微视觉变化：11px→caption(12)、15px→title(14)，属预期去漂移。
- 圆角不新增 token，直接消费 Tailwind 圆角刻度（原规范草案的 6/8/12/16 与 md/lg/xl/2xl 一致）。
- `tsconfig.vitest.json` 同时覆盖 `tests/unit`、`tests/e2e` 与 `playwright.config.ts` 的类型检查（命名沿用 vitest）。
- OsDialog 不带 `open` prop，由调用方 `v-if` 控显隐（与既有写法一致，避免双状态源）。
- **S12**：视觉基线**按平台分目录**（`snapshotPathTemplate` 带 `{platform}`）。原计划「一套基线全平台比」经实测不成立——字体栅格化与抗锯齿跨 OS 不可比，同一份 UI 在 mac 与 ubuntu 上必然 diff；故 darwin 基线守护本地，linux 基线由 CI `visual` job 首跑 `--update-snapshots` 引导生成后提交。
- **S12**：E2E 拆分没有按规划提的 `permission`/`data`/`theme-i18n`/`components` 四个名字落地，而是随各阶段按主题长出 17 个 spec（`shell/nav/apps/container/feedback/focus/theme/tree/observability/control-height/config/contrast/a11y/keyboard/visual/window/smoke`），`smoke.spec.ts` 只剩 1 条冷启动。口径改为「按主题分文件、单文件不混关注点」，命名与规划草案不同但目标已达成。
- **S12**：「覆盖率加组件维度下限」落为**目录地板**（`src/ui/**` 85/78/85/88、`src/kernel/**` 65/58/70/68），不是逐组件「至少 N 条断言」——后者要为 41 件各写一条阈值，收益低于维护成本，且组件级断言密度已由 `tests/unit/contract-helpers.ts` 的同一组跨组件断言保证。
- **S12**：CI 远端首跑**未执行**（用户决定「暂不推送」，见规划 §9 S12 条），workflow 三 job 配置已就绪，Actions 首跑由用户手动触发。
