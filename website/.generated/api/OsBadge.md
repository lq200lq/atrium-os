<!-- 由 scripts/gen-api-tables.mjs 从 OsBadge.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `count` | `number` | 否 | `0` | 计数值；仅 >0 时渲染胶囊（固定 danger 红底），0 或未传整节点不输出 |
| `max` | `number` | 否 | `9` | 计数上限，超出显示 `max+`；默认 9（即 10 显示 9+） |
| `dot` | `boolean` | 否 | `false` | 状态点型：只显示圆点（可带插槽文案），不与 count 混用 |
| `status` | `BadgeStatus` | 否 | `'default'` | 仅 dot 模式生效：圆点取语义 seed 色；count 胶囊不受影响 |

**Slots**

- `default`

**引用类型**（`src/ui/types.ts`）

```ts
/** 展示型徽标语义：Status 之外补两类只读语义（成功/进行中） */
export type BadgeStatus = Status | 'success' | 'info'
```
