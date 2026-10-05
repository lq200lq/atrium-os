<!-- 由 scripts/gen-api-tables.mjs 从 OsCollapse.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `items` | `CollapseItem[]` | 是 | — | 面板定义；标题/内容可分别经 `header-<key>`、`panel-<key>` 具名插槽覆盖 |
| `accordion` | `boolean` | 否 | `false` | true 时同时只展开一项 |

**Model**

| 绑定 | 类型 | 默认 |
| --- | --- | --- |
| `v-model` | `string[]` | `() => []` |

**Slots**

- `default`

**引用类型**（`src/ui/types.ts`）

```ts
/** OsCollapse 面板条目；内容经 `panel-<key>` 插槽提供 */
export interface CollapseItem {
  key: string
  header: string
}
```
