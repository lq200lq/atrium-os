<!-- 由 scripts/gen-api-tables.mjs 从 OsTabs.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `tabs` | `TabItem[]` | 是 | — | 页签定义；点击把 key 写回 v-model，内容区经默认作用域插槽（回传 active）或 `tab-<key>` 具名插槽渲染 |

**Model**

| 绑定 | 类型 | 默认 |
| --- | --- | --- |
| `v-model` | `string` | — |

**Slots**

- `default`
- `extra`

**引用类型**（`src/ui/types.ts`）

```ts
export interface TabItem {
  key: string
  label: string
}
```
