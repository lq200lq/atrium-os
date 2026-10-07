# Atrium OS

[![CI](https://github.com/lq200lq/atrium-os/actions/workflows/ci.yml/badge.svg)](https://github.com/lq200lq/atrium-os/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

**浏览器内桌面 OS 形态的纯前端企业级脚手架。** Vue 3 + Vite + Pinia + Tailwind CSS——把企业级前端底座（应用接入契约、权限、组件库、主题 Token、i18n、数据访问、桌面小组件）长成一个桌面操作系统的形态。

纯前端项目：没有后端，也没有 mock server。数据边界是 kernel 层的 VFS store + IndexedDB 持久化——「接真数据」指 store 的真实 CRUD，不是接服务。

## 特性

- **应用接入契约**：`npm run gen:app` 生成应用骨架，天生带权限、i18n、窗口与下钻能力
- **组件库 41 件**：`src/ui` 统一契约（Os 前缀），组件陈列应用可交互浏览
- **主题与 Token**：语义化设计 Token + 亮暗双主题，裸色值/裸间距由门禁拦截
- **i18n**：zh-CN / en-US 双语言包，键集对齐有测试护栏，界面中文硬编码有门禁
- **桌面小组件**：右锚定流式网格、拖拽与离散换档、`gen:widget` 生成器、契约门禁
- **质量线**：类型 strict、ESLint、Prettier、单测 + Playwright e2e、axe 无障碍扫描、组件级视觉基线、包体预算

## 快速开始

要求 **Node.js 24+**（仓库带 `.nvmrc`，`nvm use` 即可）。

```bash
npm ci
npm run dev        # 应用开发服
npm run docs:dev   # 文档站（website/）
```

## 质量门禁

一条命令复现 CI 的 check 岗：

```bash
npm run verify
```

| 命令                         | 作用                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `npm run verify`             | type-check、lint、format、token/widget/i18n 三门禁、覆盖率、构建 + 包体预算、文档站构建 |
| `npm run verify:e2e`         | Playwright e2e（排除 a11y / visual 专岗）                                               |
| `npm run test:e2e:a11y`      | axe 无障碍扫描 + 键盘契约                                                               |
| `npx playwright test visual` | 组件级视觉基线（darwin，按平台分目录）                                                  |
| `npm run check:tokens`       | 裸色值 / 裸间距 / 裸层级审计                                                            |
| `npm run check:i18n`         | 界面模板中文硬编码审计                                                                  |
| `npm run check:widgets`      | 小组件契约门禁（T5/T9/T12/T15）                                                         |

## 目录结构

```
src/
  apps/        应用（file-manager、data-board、settings、widget-center …）
  shell/       桌面壳层（顶栏、Dock、窗口、小组件层、Spotlight）
  ui/          Os 组件库（41 件，统一契约）
  components/  壳层与应用共享的业务组件
  widgets/     桌面小组件（10 个内置件，每件一个目录）
  kernel/      内核能力（VFS store、IndexedDB、数据访问、总线、小组件运行时）
  i18n/        zh-CN / en-US 语言包
  styles/      设计 Token 与主题
  windows/     窗口内嵌视图
website/       VitePress 文档站
scripts/       质量门禁与生成器（check-*、gen-*）
tests/unit/    Vitest 单测（含门禁脚本的 fixture 自证）
tests/e2e/     Playwright e2e（a11y / keyboard / visual / 小组件验收）
```

## 文档

在线文档站：`npm run docs:dev`（组件 API 表由 `npm run docs:gen` 从源码生成，`docs:check` 防漂移）。架构与规范的导读见 [`website/architecture.md`](website/architecture.md)。

## 贡献

欢迎 Issue 与 PR：见 [CONTRIBUTING.md](CONTRIBUTING.md)（提交约定、门禁检查单、范围红线），参与者请遵守 [行为准则](CODE_OF_CONDUCT.md)。安全问题请勿公开提交，见 [SECURITY.md](SECURITY.md)。

## 许可

[Apache License 2.0](LICENSE)
