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

圆角不另立 token：直接用 Tailwind 圆角刻度，`rounded-md/lg/xl/2xl` = 6/8/12/16px（钮/输入、卡片、窗口、Dock）。
阴影 `--shadow-window`（活跃）/ `--shadow-window-dim`（非活动）/ `--shadow-pop`（弹层）/ `--shadow-dock`（Dock 与 Widgets 卡片）。
动效 `--duration-quick` 120ms / `--duration-base` 180ms / `--duration-slow` 260ms；`--ease-out` cubic-bezier(0.22,1,0.36,1)。窗口开合 = base + ease-out。
字号层级（工具类 `text-micro/caption/ui/title`）：10（角标）/ 12（辅助）/ 13（正文 UI）/ 14（标题、输入）。

## 4. 基础组件契约（src/ui/）

形态无关、无 store 依赖（store 逻辑留在调用方）；样式只消费 token 派生类。

| 组件               | 契约                                                                               | 替换现状                                            |
| ------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------- |
| `OsIcon`（已收口） | `name: IconName; size; strokeWidth`                                                | 全仓图标                                            |
| `OsButton`         | `variant: primary/ghost/danger; size: sm/md; disabled`                             | 各应用/文件管理散落按钮                             |
| `OsInput`          | `modelValue; placeholder; @enter/@esc`                                             | 对话框输入（Spotlight/AI 输入为定制组合件，不强推） |
| `OsDialog`         | `title; confirmText/cancelText; @confirm/@cancel`（默认插槽为内容，`v-if` 控显隐） | file-manager 新建/重命名弹窗                        |
| `OsTrafficLights`  | `@close/@minimize/@maximize`                                                       | 窗口标题栏三钮                                      |
| `OsBadge`          | `count; max=9`                                                                     | 通知未读角标                                        |

开闭原则：基础组件只通过 props/slot 扩展表现，新场景优先加 variant，不在业务侧复制样式。

## 5. 目录结构增补

```text
src/
  ui/                 # 形态无关基础组件（OsButton/OsInput/OsDialog/OsTrafficLights/OsBadge）
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
