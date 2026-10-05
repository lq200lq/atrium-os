# 布局与容器

S9 落地的六件：把「拼一个后台页面最少要的那几块」收进 `src/ui`，业务侧不再手写 div 容器。全部消费 S7 刻度——间距只有 `2xs/xs/sm/md/lg/xl/2xl` 七档，圆角只有 `chip/control/surface/panel/dock/full` 六档，**响应式按窗口宽度而非视口**（`OsGrid` 外框即 `cq-window` 容器）。

## OsSpace 间距

替代裸写 `flex gap-*`，间隙走间距刻度。

| 名称        | 类型                                                      | 默认      | 说明         |
| ----------- | --------------------------------------------------------- | --------- | ------------ |
| `direction` | `'row' \| 'column'`                                       | `'row'`   | 主轴方向     |
| `size`      | `GapSize`                                                 | `'sm'`    | 间隙档位     |
| `align`     | `'start' \| 'center' \| 'end' \| 'stretch' \| 'baseline'` | `'start'` | 交叉轴对齐   |
| `wrap`      | `boolean`                                                 | `false`   | 是否允许换行 |

## OsDivider 分隔线

| 名称       | 类型      | 默认    | 说明                                     |
| ---------- | --------- | ------- | ---------------------------------------- |
| `vertical` | `boolean` | `false` | 竖向分隔（`self-stretch`，高度跟所在行） |
| `dashed`   | `boolean` | `false` | 虚线                                     |

默认插槽放内嵌文案（线条在两侧打断，**带文案时恒为横向**）。两种形态都渲染 `role="separator"` + `aria-orientation`。

## OsGrid 栅格

列数按**所在窗口**的宽度降档——多窗口桌面形态下视口断点没有意义。外框自带 `cq-window`（`container: window / inline-size`），三档由 `tokens.css` 的 `@custom-variant` 定义：`w-narrow` < 480px、`w-mid` 480–800px、`w-wide` ≥ 800px。

| 名称      | 类型                         | 默认   | 说明           |
| --------- | ---------------------------- | ------ | -------------- |
| `columns` | `1 \| 2 \| 3 \| 4 \| 5 \| 6` | `3`    | 宽窗口下的列数 |
| `gap`     | `GapSize`                    | `'md'` | 行列间隙       |

实际渲染的列数（`COLUMNS_CLASS` 为静态字面量，保证 Tailwind 能扫到变体类）：

| `columns` | narrow | mid | wide |
| --------- | ------ | --- | ---- |
| 1         | 1      | 1   | 1    |
| 2         | 1      | 2   | 2    |
| 3         | 1      | 2   | 3    |
| 4         | 1      | 2   | 4    |
| 5         | 1      | 3   | 5    |
| 6         | 2      | 3   | 6    |

::: tip 看起来"列数不对"往往是对的
gallery 里 `:columns="3"` 的示例在 726px 宽窗口内只渲染 2 列——容器实测 726px 落进 `w-mid`，降档是设计意图，不是 bug。想知道当前容器宽度：读 `.cq-window` 的 `clientWidth`。
:::

## OsCard 卡片

| 名称       | 类型      | 默认   | 说明                                                  |
| ---------- | --------- | ------ | ----------------------------------------------------- |
| `title`    | `string`  | `''`   | 标题，空串时用 `title` 插槽                           |
| `bordered` | `boolean` | `true` | 是否描边                                              |
| `padded`   | `boolean` | `true` | 内容区是否套用 `md` 内边距；嵌表格/图片等铺满件时关掉 |

插槽：`title`、`extra`（标题行右侧操作区）、默认（内容）、`footer`（自带上描边）。

## OsDescriptions 详情键值对

只读详情（抽屉/卡片内查看属性）。**字段必须是可编辑字段的子集**，不放大纲之外的推导值。

| 名称     | 类型                | 默认 | 说明                         |
| -------- | ------------------- | ---- | ---------------------------- |
| `items`  | `DescriptionItem[]` | —    | 条目（必填）                 |
| `title`  | `string`            | `''` | 区块标题                     |
| `column` | `1 \| 2`            | `1`  | 宽窗口下的列数，窄窗口恒为 1 |

```ts
interface DescriptionItem {
  key: string
  label: string
  value?: string
  slot?: string // 指定具名插槽自定义值
}
```

值插槽名：`item.slot` 优先，否则 `value-<key>`。

## OsCollapse 折叠面板

| 名称        | 类型             | 默认    | 说明             |
| ----------- | ---------------- | ------- | ---------------- |
| `items`     | `CollapseItem[]` | —       | 面板定义（必填） |
| `accordion` | `boolean`        | `false` | 同时只展开一项   |

```ts
interface CollapseItem {
  key: string
  header: string
}
```

Model：`v-model: string[]`（展开的 key 列表）。**未绑定 v-model 时 `defineModel` 自动退化为内部状态**，受控与非受控走同一条代码路径。

插槽：`header-<key>` 覆盖标题，`panel-<key>` 提供内容。

## 用法

```vue
<OsCard title="统计概览">
  <template #extra>
    <OsSegmented v-model="view" :options="viewOptions" label="视图" />
  </template>
  <OsGrid :columns="3">
    <OsDescriptions :items="statItems" />
    <OsSpace direction="column" size="xs">
      <OsTypography type="title">分布</OsTypography>
      <OsDivider />
      <OsTag status="info">全部</OsTag>
    </OsSpace>
  </OsGrid>
  <template #footer>
    <OsSpace size="xs"><OsButton>导出</OsButton></OsSpace>
  </template>
</OsCard>
```
