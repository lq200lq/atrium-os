---
'atrium-os': minor
---

S8 组件契约统一：新增 `src/ui/types.ts`（`Size`/`Status`/`CommonProps`/`BadgeStatus` + 集中导出 `TableColumn`/`FormField`/`SelectOption`/`TabItem`/`RadioOption`，SFC 内保留 re-export）与 `src/ui/index.ts` 统一出口；`src/ui/internal/` 收口刻度→工具类映射（`control.ts`）与 Input/Select 共用控件外框（`ControlShell.vue`）。六件组件契约补齐：`OsButton` 加 `lg` 档与 `loading`、`OsInput` 加 `size/disabled/status/clearable` 与前后缀插槽、`OsSelect` 加 `size/loading/status`、`OsTooltip` 加四向 `placement`、`OsBadge` 加圆点状态型、`OsDialog` 加确认 `loading` 与 `maskClosable`。size/disabled/status 的跨组件一致性改由一处共享断言跑遍六个录入组件；单测按组件拆成 16 个文件（199 例），控件高度像素一致性新增 E2E 断言；组件陈列册增「通用约定」段同屏对照 size/status/disabled/loading。
