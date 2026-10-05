<!-- 由 scripts/gen-api-tables.mjs 从 OsDescriptions.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `items` | `DescriptionItem[]` | 是 | — | 条目列表；每项值经 item.slot ?? `value-<key>` 具名插槽自定义，缺省渲染 item.value |
| `title` | `string` | 否 | `''` | 非空时渲染 h4 区块标题（进无障碍标题树）；空串不出标题 |
| `column` | `1 \| 2` | 否 | `1` | 宽窗口下的列数（窄窗口恒为 1 列） |

**Slots**

- `default`

**引用类型**（`src/ui/types.ts`）

```ts
/** OsDescriptions 键值条目；提供 slot 名时用该插槽自定义值 */
export interface DescriptionItem {
  key: string
  label: string
  value?: string
  slot?: string
}
```
