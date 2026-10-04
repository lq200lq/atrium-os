# 设计 Token

WebOS 采用 **两层 token 体系**，让暗色/强调色切换只需换原始值、零工具类与组件改动。

## 分层结构

```text
语义层  tokens.css      --color-*: var(--raw-*)     ← 组件只消费这一层
原始层  theme-light.css --raw-*: <浅色值>
        theme-dark.css  --raw-*: <深色值>           ← :root[data-theme='dark'] 覆盖
```

- `tokens.css` 的 `@theme --color-*` 一律引用 `--raw-*`，组件用 `bg-surface`/`text-ink`/`border-line` 等语义类。
- `theme-light.css` / `theme-dark.css` 只定义 `--raw-*`。暗色切换仅换原始值。
- **源码顺序**：`theme-dark.css` 在 `theme-light.css` 之后引入，使 `:root[data-theme='dark']`（与 accent 预设同 `0,2,0` 特异度）靠顺序压过 `:root[data-accent='*']`。
- 暗色下的 `accent-strong`/`accent-soft` 由 `color-mix(in oklab, var(--raw-accent) N%, …)` 派生。

## 语义色 Token 清单

| Token                                                                | 用途                   |
| -------------------------------------------------------------------- | ---------------------- |
| `--color-surface` / `-hover` / `-sunken`                             | 表面 / 悬停 / 凹陷背景 |
| `--color-ink` / `-mute` / `-strong`                                  | 正文 / 次要 / 强调文字 |
| `--color-line` / `-soft`                                             | 分隔线 / 弱分隔线      |
| `--color-accent` / `-strong` / `-soft`                               | 强调色 / 深 / 浅       |
| `--color-on-accent`                                                  | 强调色之上的文字       |
| `--color-danger` / `warning` / `success`                             | 危险 / 警告 / 成功     |
| `--color-scrim`                                                      | 遮罩                   |
| `--color-glass-base` / `-raise` / `-strong` / `-pop` / `-bar`        | 玻璃材质层级           |
| `--color-glass-border` / `-active`                                   | 玻璃边框 / 激活态      |
| `--color-traffic-close` / `-min` / `-max`                            | 窗口红绿黄三钮         |
| `--color-file-dir` / `-docx` / `-xlsx` / `-pptx` / `-pdf` / `-other` | 文件类型着色           |

每个语义 token 都有对应的 `--raw-*` 原始值（共 31 组），在 light/dark 两套主题文件里分别取值。

## 主题切换 API

`theme` store（`kernel/stores/theme.ts`）：

```ts
state: { wallpaper, mode: 'light' | 'dark', accent: 'sky' | 'violet' | 'emerald' | 'rose' }
```

- `setMode(mode)` / `toggleMode()` / `setAccent(key)` / `cycleWallpaper()`
- `apply()` 把 `mode`/`accent` 写到 `document.documentElement.dataset`，CSS 据此换 `--raw-*`。
- 持久化键 `theme-v1`，带 `THEME_VERSION=2` 与迁移（旧数据只有 wallpaper 时可读，mode/accent 回落默认）。

## 约束

- **禁止散落硬编码色值**：源码不出现裸 hex / Tailwind 调色板类（`bg-slate-500` 等），lint + grep 双查。
- 装饰性渐变（应用磁贴 `tint`）是例外，但收敛在 manifest / 组件参数里。
