# 组件总览

`src/ui` 提供 18 个 `Os*` 基础组件，全部消费语义 token（暗色/强调色切换零改动），文案经 vue-i18n 本地化。业务代码应复用这些组件而非复制样式。

| 组件                     | 品类 | 说明                                                      |
| ------------------------ | ---- | --------------------------------------------------------- |
| [OsTable](./table)       | 展示 | 泛型表格，内建 loading/empty/error 三态、排序、选择、分页 |
| [OsForm](./form)         | 录入 | 声明式表单，字段驱动 + 校验                               |
| OsInput                  | 录入 | 文本输入，`enter`/`esc` 事件                              |
| OsSelect                 | 录入 | 下拉选择                                                  |
| OsRadio                  | 录入 | 单选组                                                    |
| OsCheckbox               | 录入 | 复选框                                                    |
| OsSwitch                 | 录入 | 开关                                                      |
| [OsDialog](./feedback)   | 反馈 | 模态确认框                                                |
| [OsDrawer](./feedback)   | 反馈 | 侧边抽屉                                                  |
| [OsTooltip](./feedback)  | 反馈 | 文字提示                                                  |
| [OsToast](./feedback)    | 反馈 | 轻提示（由通知中心驱动）                                  |
| [OsEmpty](./feedback)    | 反馈 | 空状态                                                    |
| [OsSkeleton](./feedback) | 反馈 | 骨架屏                                                    |
| OsBadge                  | 展示 | 计数胶囊                                                  |
| OsPagination             | 展示 | 分页页脚                                                  |
| OsTabs                   | 展示 | 页签容器                                                  |
| OsButton                 | 基础 | 按钮（primary/ghost/danger × sm/md）                      |
| OsTrafficLights          | 基础 | 窗口红绿黄三钮                                            |

## 通用约定

- **双向绑定**用 `defineModel`：`v-model`（主值）、`v-model:selected` / `v-model:page`（具名）。
- **文案**默认走 i18n（`common.*`/`validation.*`），props 传入的非空字符串覆盖默认。
- **颜色**只用语义 token，不接受裸色值 prop。
