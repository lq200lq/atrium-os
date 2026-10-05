# OsTable 表格

泛型表格组件（`generic="T"`），内建 loading / empty / error 三态、本地或远端排序、行选择与分页页脚。

## API

<!--@include: ../.generated/api/OsTable.md -->

## 三态优先级

`error`（非空）> `loading` > `empty`（rows 为空）> 正常渲染。error 态内建 `OsEmpty` + 重试按钮，文案走 `common.retry`。

## 排序与分页

- **本地排序**（默认）：点列头在 `asc → desc → null` 间循环，只重排内部副本，不改写传入的 `rows` 数组。
- **远端排序**（`remote`）：表格不重排，仅派发 `sort-change`。
- **分页**：传 `total` 才出页脚。本地模式下表格按 `v-model:page` + `page-size` **截取当页行**——父级传全量数据即可；`remote` 模式不截（父级只传当页数据，再截会翻空）。首列「全选」始终作用于当前展示行。

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
