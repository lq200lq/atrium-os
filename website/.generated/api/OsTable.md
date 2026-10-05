<!-- 由 scripts/gen-api-tables.mjs 从 OsTable.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `columns` | `TableColumn<T>[]` | 是 | — | 列定义；col.slot 存在时单元格走同名具名插槽，否则直接渲染 row[col.key] |
| `rows` | `T[]` | 是 | — | 数据行；本地排序只重排内部副本、不改写原数组；非 remote 且给了 total 时由组件按页截取 |
| `rowKey` | `keyof T & string` | 否 | `'id'` | 行唯一键字段名：行 :key 与 v-model:selected 存的值都取该字段 |
| `loading` | `boolean` | 否 | `false` | 加载态，表格区内居中渲染 OsSpin（S10 loading 契约，非骨架屏） |
| `selectable` | `boolean` | 否 | `false` | 显示首列复选框；全选作用于当前展示行并把 key 写回 v-model:selected |
| `remote` | `boolean` | 否 | `false` | 排序/分页由远端驱动时为 true：表格只做展示与事件派发，不本地排序 |
| `emptyText` | `string` | 否 | `''` | 空状态文案，空串回退 common.empty；error/loading 态不消费 |
| `error` | `string` | 否 | `''` | 非空字符串时进入 error 三态，覆盖 loading/empty；配合 @retry 重试 |
| `pageSize` | `number` | 否 | `10` | 每页条数：透传给页脚 OsPagination，并在本地模式（非 remote）下决定表体每页截取多少行 |
| `total` | `number` | 否 | `undefined` | 传入（非 undefined）才渲染分页页脚；本地模式下同时启用按页截取，远端模式仅出页码不截行 |

**Model**

| 绑定 | 类型 | 默认 |
| --- | --- | --- |
| `v-model:selected` | `(string \| number)[]` | `() => []` |
| `v-model:page` | `number` | `1` |

**Emits**

| 事件 | 载荷 | 说明 |
| --- | --- | --- |
| `'sort-change'` | `payload: { key: string; order: SortOrder }` | 点击 sortable 列表头派发；order 循环 asc→desc→null，本地模式同时重排展示，remote 模式仅通知父级 |
| `'row-click'` | `row: T` | 单击数据行派发；选择列与 actions 列的点击已 stop，不会触发 |
| `'row-dblclick'` | `row: T` | 双击数据行派发；紧随其前的 row-click 也会发出 |
| `retry` | — | error 三态下点击内建重试按钮派发；组件自身不重新请求 |

**Slots**

- `default`
- `actions`
- `empty-action`

**引用类型**（`src/ui/types.ts`）

```ts
export interface TableColumn<T> {
  key: keyof T & string
  title: string
  width?: string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  /** 具名插槽名；提供后用该插槽自定义单元格，否则直接渲染 row[key] */
  slot?: string
}
```
