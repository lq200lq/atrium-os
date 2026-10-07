# 贡献指南

感谢参与 Atrium OS。本文是提交代码前的检查单；设计口径以 `docs/` 内文档为准（docs-first，实施偏差回写对应文档）。

## 环境

- **Node.js ≥ 24**（仓库带 `.nvmrc`，`nvm use` 即可）
- npm（随 Node 分发）

```bash
git clone https://github.com/lq200lq/atrium-os.git
cd atrium-os
npm ci
npm run dev
```

## 提交约定

- 单行格式：`类型：描述`，冒号是**全角「：」**（commitlint 门禁强制）
- 类型取值：`feat` / `fix` / `docs` / `style` / `refactor` / `perf` / `test` / `build` / `ci` / `chore` / `revert`
- **一个提交只装一条工作线**，不把并行线的改动顺手捎上
- pre-commit 会跑 lint-staged（eslint --fix + prettier）与 type-check，不过不给提交

## PR 检查单

提交 PR 前，本地至少跑通与 CI check 岗同源的门禁：

- [ ] `npm run verify` 全绿（type-check / lint / format / token·widget·i18n 门禁 / 覆盖率 / 构建 + 包体预算 / 文档站）
- [ ] 动了界面或交互：`npm run verify:e2e`
- [ ] 动了浮层、焦点或语义：`npm run test:e2e:a11y`
- [ ] 动了组件外观：`npx playwright test visual`（darwin 基线与改动同一提交重生成）

几条容易踩的约定：

- **界面 chrome 必须走 `t()`**，双语言包键集对齐（`npm run check:i18n` 拦模板中文硬编码）；演示数据（文件名、种子行）留 `<script>` 或数据源
- **源码不得出现裸色值/裸间距**，一律走 `src/styles` 的 Token（`npm run check:tokens`）
- **新增门禁脚本要带 fixture 自证**：注入违规必须 exit 1、合规写法不误报，仿 `tests/unit/tokenAudit.test.ts`
- **覆盖率地板分目录**（`vitest.config.ts`）：先补测再扩 include，不调低地板凑绿

## 范围红线

本项目是**纯前端**：不建后端、不建 mock server。数据需求一律走 kernel VFS store + IndexedDB；「接真数据」指 store 的真实 CRUD。

## 变更记录

用户可见的改动用 `npm run changeset` 记录一条。changesets 在本仓库只维护 `CHANGELOG.md`（`npm run version`），**不发布 npm**（`private: true`）。

## 行为准则

参与即表示同意 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。
