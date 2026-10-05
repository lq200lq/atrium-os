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

---

## S10 反馈件

### OsAlert 提示条

<!--@include: ../.generated/api/OsAlert.md -->

四级语义 `info / success / warning / error` 的浅底、文字与描边全部取 S7 语义派生刻度（`-bg` / `-text` / `-border`），组件内不调色。`banner` 只改 `role`（`alert` ↔ `status`）与警示语义，不改外观；`closable` 的关闭钮 `aria-label` 走 `common.close`。

### OsSpin 加载中

<!--@include: ../.generated/api/OsSpin.md -->

两种用法：内联型（裸指示器，`loading` 缺省 `true`）与容器型（包住内容、盖一层 `bg-surface/60` 遮罩，层级 `z-sticky`）。直径取 `h-control-*` 刻度而非任意 px；`OsTable` 的 loading 态已从骨架屏改为本件（骨架屏留给「结构未知」的首屏，表格结构已知）。

### OsProgress 进度

<!--@include: ../.generated/api/OsProgress.md -->

`percent` 内部钳到 `0..100`，两条 `role="progressbar"` 都带 `aria-valuenow/min/max`。`status` **缺省由 percent 推导**：满格即 `success`（数据上等价，手传只会多一处漂移源），`exception` 是推不出的旁路失败信号、必须显式传。`strokeWidth` 是几何参数（轨道厚度 / 环宽），允许落内联 px，与 `OsAvatar.size` 同类。

### OsResult 结果页

<!--@include: ../.generated/api/OsResult.md -->

`403` 一档专门承接 S2 鉴权拒绝的落地表现（gallery 里演示「去设置」→ `windowManager.open('settings')`）。缺省标题走 i18n `result.*`，`icon` / `default` / `extra` 三个插槽分别覆写图标、正文区与操作区。

### OsPopconfirm 气泡确认

<!--@include: ../.generated/api/OsPopconfirm.md -->

定位复用 `src/ui/internal/placement.ts` 的 12 值原语，层级 `z-panel`。行为契约（与 `OsDialog` 一致，也是 S12 键盘规范的原型）：打开 → 焦点进入确认钮；Esc / 再点触发元素 / 外点 → 关闭并把焦点还给触发元素。`document` 上的 `pointerdown` 只在打开期间挂、关闭与卸载都解绑。

## 命令式反馈（`useFeedback`）

`src/ui/feedback.ts` 把「弹提示 / 要确认」收敛成组件级 API，`src/shell/FeedbackHost.vue` 挂在壳层根节点并通过 `provide` 交给整棵应用树：

```vue
<script setup lang="ts">
import { useFeedback } from '@/ui/feedback'
const feedback = useFeedback()

async function onDelete(path: string) {
  if (!(await feedback.confirm({ title: '移入回收站', content: path, okText: '删除' }))) return
  feedback.success('已移入回收站', path)
}
</script>
```

| 方法                                                 | 说明                                           |
| ---------------------------------------------------- | ---------------------------------------------- |
| `notify({ title, body?, level?, action? })`          | 通用入口，返回该条通知 id                      |
| `success / error / warning / info(title, body?)`     | 四档快捷入口                                   |
| `confirm({ title, content?, okText?, cancelText? })` | 返回 `Promise<boolean>`；true=确认，false=取消 |

设计约束（与 antd 的差异都写在这儿）：

- **走上下文，不做模块级单例**。`useFeedback()` 在没有宿主的树里直接抛错，而不是静默回退到全局实例——全局实例读不到当前 app 的语言、主题与作用域配置，这是 antd 静态 `message.*` 反复被投诉的根因，不在这里重演。
- **不另起一套通知系统**。`notify` 写的就是 `useNotification` store 的队列，`level` 是 `Notice` 上的字段；吐司、通知中心、`OsAlert` 共用 `src/ui/internal/level.ts` 里同一张「等级 → 语义色 / 图标」表，同一等级在三处的颜色与图标必然一致。
- **吐司的播报语义随等级变**：`error` / `warning` 用 `role="alert"`（打断式），`info` / `success` 用 `role="status"`（被动）。缺省等级为 `info`，所以不传 `level` 的旧调用行为不变。
- **后发起的 `confirm` 覆盖前一个**，并把前者判为 `false` resolve，不留永不落定的 Promise。
