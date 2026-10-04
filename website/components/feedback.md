# 反馈与展示组件

## OsDialog 模态确认框

| Prop          | 类型     | 默认 | 说明                                    |
| ------------- | -------- | ---- | --------------------------------------- |
| `title`       | `string` | —    | 标题（必填）                            |
| `confirmText` | `string` | `''` | 确认按钮文案，空串回退 `common.confirm` |
| `cancelText`  | `string` | `''` | 取消按钮文案，空串回退 `common.cancel`  |

- Emits：`confirm`、`cancel`（点击遮罩也派发 `cancel`）。
- 默认插槽放正文内容。

## OsDrawer 侧边抽屉

| Prop        | 类型                | 默认      | 说明     |
| ----------- | ------------------- | --------- | -------- |
| `title`     | `string`            | `''`      | 标题     |
| `placement` | `'right' \| 'left'` | `'right'` | 弹出方向 |
| `width`     | `string`            | `'360px'` | 抽屉宽度 |

- Model：`v-model`（`boolean`，必填）控制开合。
- Emits：`close`。具名插槽 `footer` 放底部操作。`Teleport` 到 body。

## OsTooltip 文字提示

| Prop        | 类型                | 默认    | 说明             |
| ----------- | ------------------- | ------- | ---------------- |
| `text`      | `string`            | —       | 提示文字（必填） |
| `placement` | `'top' \| 'bottom'` | `'top'` | 方位             |

默认插槽为触发元素。

## OsEmpty 空状态

| Prop          | 类型       | 默认      | 说明                          |
| ------------- | ---------- | --------- | ----------------------------- |
| `icon`        | `IconName` | `'boxes'` | 图标                          |
| `description` | `string`   | `''`      | 描述，空串回退 `common.empty` |

## OsSkeleton 骨架屏

| Prop      | 类型                           | 默认     | 说明              |
| --------- | ------------------------------ | -------- | ----------------- |
| `variant` | `'text' \| 'rect' \| 'circle'` | `'text'` | 形状              |
| `rows`    | `number`                       | `3`      | 行数（text 变体） |

## OsBadge 计数胶囊

| Prop    | 类型     | 默认 | 说明                  |
| ------- | -------- | ---- | --------------------- |
| `count` | `number` | —    | 计数（必填）          |
| `max`   | `number` | `9`  | 上限，超出显示 `max+` |

只渲染计数胶囊、无默认插槽；需要包裹内容时用普通 `<span>`。

## OsPagination 分页页脚

| Prop       | 类型     | 默认 | 说明           |
| ---------- | -------- | ---- | -------------- |
| `total`    | `number` | —    | 总条数（必填） |
| `pageSize` | `number` | `10` | 每页条数       |

- Model：`v-model`（`number`，必填）当前页。总数文案走 `pagination.total`（`共 {n} 条`）。

## OsTabs 页签容器

| Prop   | 类型                            | 说明             |
| ------ | ------------------------------- | ---------------- |
| `tabs` | `TabItem[]`（`{ key, label }`） | 页签定义（必填） |

- Model：`v-model`（`string`，必填）当前 active key。
- 默认作用域插槽回传 `active`；也可用具名插槽 `tab-<key>`；`extra` 插槽放页签栏右侧附加内容。

## OsToast 轻提示

由通知中心（`useNotification().push`）驱动渲染，一般不直接在应用内使用。
