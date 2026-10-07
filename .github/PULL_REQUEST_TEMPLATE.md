## 变更说明

<!-- 这条工作线做了什么、为什么；关联的规划文档段落或 issue -->

## 验证

- [ ] `npm run verify` 全绿（与 CI check 岗同源）
- [ ] 动了界面/交互：`npm run verify:e2e`
- [ ] 动了浮层/焦点：`npm run test:e2e:a11y`
- [ ] 动了组件外观：`npx playwright test visual`（darwin 基线随改动同一提交重生成）

## 约定自检

- [ ] 一个 PR 只装一条工作线，未夹带并行改动
- [ ] 新增界面文案走 `t()` 且双语言包键对齐（`check:i18n`）
- [ ] 提交信息为中文 `类型：描述`（全角冒号）
