---
'webos': minor
---

S12 质量线：无障碍、视觉回归与流程门禁。**a11y 门禁默认执行**——`tests/e2e/a11y.spec.ts` 解除 `A11Y=1` 门控（四场景：壳层冷启动 / Spotlight / 组件陈列逐页签 / 设置窗口），已知违规基线 `BASELINE` 清空为 `{}`，即 0 个 axe serious/critical；`tests/e2e/contrast.spec.ts` 在 5 语义 × 明暗 × 4 预设之外补上 S7 的盲区（中性 `ink-mute` 叠 5 级表面、`on-accent` 实底前景），共 16 条。扫描做过非空跑证明：注入无 label 输入框与无 alt 图片，axe 如实报出 `label:critical` + `image-alt:critical`。

**键盘与焦点契约成文并验收**：`⌘K`/`Ctrl+K` 由「只开」改成开合开关（`App.vue`），Spotlight 结果以 `aria-current` 标活动项、Esc 关闭后焦点归还顶栏搜索入口，`OsDrawer` 补上原本完全缺失的 Esc 通道（`watch(open)` 记住 `activeElement`，关闭时归还焦点，与 `OsDialog` 同口径），`prefers-reduced-motion` 降级新增验收（时长实测 ≤1ms 且窗口开合状态切换照常完成）。`tests/e2e/keyboard.spec.ts` 6 条 + 单测 2 条覆盖，规范文档 §4 落地为 8 条契约表。未做：浮层焦点陷阱与自动聚焦（`aria-modal` 已声明但键盘仍可 Tab 到浮层背后），单独立项。

**视觉回归基线**（规划 §8 定案的窄口径）：`tests/e2e/visual.spec.ts` 10 张组件级截图基线随仓库提交——壳层浅色/暗色、Spotlight 浮层、组件陈列窗口的 7 个页签。不确定项三处钉死：`page.clock.setFixedTime` 冻结顶栏时钟 / Widgets 日历 / vfs 种子时间戳、`reducedMotion: 'reduce'`、`animations: 'disabled'`，因此无需 mask 遮任何区域。基线按平台分目录（`snapshotPathTemplate` 带 `{platform}`），因字体栅格化跨 OS 不可比；门禁有效性用漂移实验双向验证（`--radius-control` 6px→9px 即红，恢复后 `--repeat-each=2` 稳定）。

**流程**：`commitlint` + `.husky/commit-msg` 落地中文「类型：描述」全角冒号约定（`headerPattern` 按全角冒号拆分，否则中文提交全判 `type-empty`）；覆盖率阈值从全局 60/50 改为分档地板（`src/ui/**`、`src/kernel/**` 各设下限）；CI 从单 job 拆成 `check` / `a11y` / `visual` 三 job，并补 `format:check` 全仓一致性一步。CI 远端首跑按用户决定暂未触发，配置就绪。
