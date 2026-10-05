<!-- 由 scripts/gen-api-tables.mjs 从 OsPopconfirm.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `title` | `string` | 否 | `''` |  |
| `description` | `string` | 否 | `''` |  |
| `okText` | `string` | 否 | `''` |  |
| `cancelText` | `string` | 否 | `''` |  |
| `placement` | `Placement` | 否 | `'bottom'` |  |
| `disabled` | `boolean` | 否 | `false` |  |

**Emits**

| 事件 | 载荷 | 说明 |
| --- | --- | --- |
| `confirm` | — |  |
| `cancel` | — |  |

**Slots**

- `default`
- `description`

**引用类型**（`src/ui/types.ts`）

```ts
/**
 * 浮层方位（S10 定位原语）：四边 × 三对齐 = 12 值。
 * OsTooltip / OsPopconfirm 共享，类串映射在 `src/ui/internal/placement.ts`。
 */
export type Placement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end'
  | 'right'
  | 'right-start'
  | 'right-end'
```
