# OsTable 表格

泛型表格组件（`generic="T"`），内建 loading / empty / error 三态、本地或远端排序、行选择与分页页脚。

## Props

| 名称         | 类型               | 默认        | 说明                                                                  |
| ------------ | ------------------ | ----------- | --------------------------------------------------------------------- |
| `columns`    | `TableColumn<T>[]` | —           | 列定义（必填）                                                        |
| `rows`       | `T[]`              | —           | 数据行（必填）                                                        |
| `rowKey`     | `keyof T & string` | `'id'`      | 行唯一键字段                                                          |
| `loading`    | `boolean`          | `false`     | 加载态，渲染骨架屏                                                    |
| `selectable` | `boolean`          | `false`     | 是否显示选择列                                                        |
| `remote`     | `boolean`          | `false`     | 为 `true` 时排序/分页交由父级（远端驱动），表格只派发事件不本地排序   |
| `emptyText`  | `string`           | `''`        | 空状态文案，空串回退 `common.empty`                                   |
| `error`      | `string`           | `''`        | 非空字符串进入 error 三态，**优先级高于 loading/empty**，内建重试按钮 |
| `pageSize`   | `number`           | `10`        | 每页条数                                                              |
| `total`      | `number`           | `undefined` | 总条数（远端分页时传入）                                              |

## TableColumn\<T\>

```ts
interface TableColumn<T> {
  key: keyof T & string
  title: string
  width?: string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  slot?: string // 具名插槽名；提供后用该插槽自定义单元格，否则直接渲染 row[key]
}
```

## Models

| 名称               | 类型                   | 说明                |
| ------------------ | ---------------------- | ------------------- |
| `v-model:selected` | `(string \| number)[]` | 选中行 key 集合     |
| `v-model:page`     | `number`               | 当前页码（从 1 起） |

## Emits

| 事件           | 载荷                                              | 说明                 |
| -------------- | ------------------------------------------------- | -------------------- |
| `sort-change`  | `{ key: string; order: 'asc' \| 'desc' \| null }` | 排序变更             |
| `row-click`    | `row: T`                                          | 单击行               |
| `row-dblclick` | `row: T`                                          | 双击行               |
| `retry`        | —                                                 | error 三态下点击重试 |

## 三态优先级

`error`（非空）> `loading` > `empty`（rows 为空）> 正常渲染。error 态内建 `OsEmpty` + 重试按钮，文案走 `common.retry`。

## 用法

```vue
<OsTable
  v-model:selected="selected"
  v-model:page="page"
  :columns="columns"
  :rows="rows"
  :loading="loading"
  :error="error"
  remote
  @sort-change="onSort"
  @retry="reload"
>
  <template #role="{ value }"><OsBadge :count="value" /></template>
</OsTable>
```
