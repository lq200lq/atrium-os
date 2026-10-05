<!-- 由 scripts/gen-api-tables.mjs 从 OsPagination.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `pageSize` | `number` | 否 | `10` | 每页条数；页数 = ceil(total / pageSize)，同时透传给页码窗口计算 |
| `total` | `number` | 是 | — | 总条数；驱动页数计算与 pagination.total 文案（共 {n} 条） |

**Model**

| 绑定 | 类型 | 默认 |
| --- | --- | --- |
| `v-model` | `number` | — |
