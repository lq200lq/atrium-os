# 组件总览

`src/ui` 提供 40 个 `Os*` 基础组件（另加 `src/components/OsIcon`），全部消费语义 token（暗色/强调色切换零改动），文案经 vue-i18n 本地化。业务代码应复用这些组件而非复制样式。

| 组件                       | 品类 | 说明                                                      |
| -------------------------- | ---- | --------------------------------------------------------- |
| [OsTable](./table)         | 展示 | 泛型表格，内建 loading/empty/error 三态、排序、选择、分页 |
| [OsTree](./display)        | 展示 | 树：勾选联动、懒加载、roving tabindex 键盘导航            |
| [OsForm](./form)           | 录入 | 声明式表单，字段驱动 + 校验                               |
| OsInput                    | 录入 | 文本输入，`enter`/`esc` 事件                              |
| [OsTextarea](./form)       | 录入 | 多行输入，`autosize` + 字数                               |
| [OsInputNumber](./form)    | 录入 | 数值输入，步进/钳制/精度                                  |
| OsSelect                   | 录入 | 下拉选择                                                  |
| [OsSegmented](./display)   | 录入 | 分段选择器（视图切换）                                    |
| OsRadio                    | 录入 | 单选组                                                    |
| OsCheckbox                 | 录入 | 复选框                                                    |
| OsSwitch                   | 录入 | 开关                                                      |
| [OsDialog](./feedback)     | 反馈 | 模态确认框                                                |
| [OsDrawer](./feedback)     | 反馈 | 侧边抽屉                                                  |
| [OsTooltip](./feedback)    | 反馈 | 文字提示                                                  |
| [OsToast](./feedback)      | 反馈 | 轻提示（由通知中心驱动）                                  |
| [OsEmpty](./feedback)      | 反馈 | 空状态                                                    |
| [OsSkeleton](./feedback)   | 反馈 | 骨架屏                                                    |
| [OsAlert](./feedback)      | 反馈 | 提示条（四语义 + `banner` 型）                            |
| [OsSpin](./feedback)       | 反馈 | 加载中：内联指示器 / 容器遮罩                             |
| [OsProgress](./feedback)   | 反馈 | 进度：条形 / 环形，`status` 缺省由 percent 推导           |
| [OsResult](./feedback)     | 反馈 | 结果页（`success`/`error`/`403`/`warning`）               |
| [OsPopconfirm](./feedback) | 反馈 | 气泡确认，浮层键盘与焦点回归的原型                        |
| [OsMenu](./nav)            | 导航 | 菜单（纵向/横向），roving tabindex 键盘导航               |
| [OsDropdown](./nav)        | 导航 | 下拉菜单浮层，键盘委托 OsMenu                             |
| [OsBreadcrumb](./nav)      | 导航 | 面包屑路径栏，超长折叠复用 OsDropdown                     |
| [OsSteps](./nav)           | 导航 | 步骤条，四态由 current 推导，窄窗口退化纵向               |
| OsBadge                    | 展示 | 计数胶囊 / 状态圆点                                       |
| [OsTag](./display)         | 展示 | 标签（属性/分类，五档预设 tint）                          |
| [OsAvatar](./display)      | 展示 | 头像（图 / 文本 / 图标三级回退）                          |
| [OsTypography](./display)  | 展示 | 排版：字阶 + 省略 + 展开                                  |
| [OsDescriptions](./layout) | 展示 | 只读详情键值对，窄窗口恒 1 列                             |
| [OsCard](./layout)         | 容器 | 标题 / 操作区 / 内容 / 页脚，可关内边距                   |
| [OsCollapse](./layout)     | 容器 | 折叠面板（`accordion` 单选展开）                          |
| [OsGrid](./layout)         | 布局 | 按**窗口宽度**降档的栅格（container query）               |
| [OsSpace](./layout)        | 布局 | 间隙 + 对齐，替代裸写 `flex gap-*`                        |
| [OsDivider](./layout)      | 布局 | 分隔线，可内嵌文案                                        |
| OsPagination               | 展示 | 分页页脚                                                  |
| OsTabs                     | 展示 | 页签容器                                                  |
| OsButton                   | 基础 | 按钮（primary/ghost/danger × sm/md/lg）                   |
| OsIcon                     | 基础 | 图标唯一出口（`IconName` 白名单，位于 `src/components`）  |
| OsTrafficLights            | 基础 | 窗口红绿黄三钮                                            |

## 通用约定

- **双向绑定**用 `defineModel`：`v-model`（主值）、`v-model:selected` / `v-model:page`（具名）。给默认值的 model 在未绑定时自动退化为内部状态，受控/非受控共用一条代码路径。
- **文案**默认走 i18n（`common.*`/`validation.*`），props 传入的非空字符串覆盖默认。
- **颜色**只用语义 token，不接受裸色值 prop。
- **响应式按窗口，不按视口**：`OsGrid` / `OsDescriptions` 的多列布局与 `OsSteps` 的横→纵退化都读 `.cq-window` 容器（窗口自身宽度）降档，多窗口并排时每个窗口独立适配。
- **API 表是生成物**：S10 起各页的 Props/Model/Emits/Slots 表由 `scripts/gen-api-tables.mjs` 从组件源码（props 声明 + 单行 JSDoc + `defineModel`/`defineEmits` + 模板插槽）生成到 `website/.generated/api/`，页面用 `<!--@include: -->` 引入；改 props 后要跑 `npm run docs:gen`，`docs:build` 会先跑 `--check`，漂移即构建失败。
