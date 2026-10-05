<!-- 由 scripts/gen-api-tables.mjs 从 OsBreadcrumb.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `items` | `BreadcrumbItem[]` | 是 | — | 路径条目（顺序即层级）；末项恒为当前页，不可点并带 aria-current="page" |
| `separator` | `string` | 否 | `'/'` | 层级分隔符；独立 span 渲染（aria-hidden），不混入条目文本 |
| `maxVisibleItems` | `number` | 否 | `0` | 超过该数量时折叠中间层级（省略号经 OsDropdown 承载）；小于 3 或 0 表示不折叠 |

**Emits**

| 事件 | 载荷 | 说明 |
| --- | --- | --- |
| `click` | `item: BreadcrumbItem` | 点击非当前页层级（或折叠下拉中被选中的层级）时派发；href 条目同时保留链接跳转 |

**引用类型**（`src/ui/types.ts`）

```ts
/** OsBreadcrumb 路径条目；末项恒视为当前页（不可点）。key 缺省时以 index 兜底 */
export interface BreadcrumbItem {
  key?: string
  label: string
  icon?: IconName
  /** 提供时该层级渲染为链接（href 由调用方保证安全） */
  href?: string
}
```
