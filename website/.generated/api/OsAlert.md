<!-- 由 scripts/gen-api-tables.mjs 从 OsAlert.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `type` | `BadgeStatus` | 否 | `'info'` |  |
| `message` | `string` | 否 | `''` |  |
| `description` | `string` | 否 | `''` |  |
| `closable` | `boolean` | 否 | `false` |  |
| `showIcon` | `boolean` | 否 | `true` |  |
| `banner` | `boolean` | 否 | `false` | banner 型：更强的警示语义，aria role 取 alert（非 banner 为被动 status） |

**Emits**

| 事件 | 载荷 | 说明 |
| --- | --- | --- |
| `close` | — |  |

**Slots**

- `default`
- `action`

**引用类型**（`src/ui/types.ts`）

```ts
/** 展示型徽标语义：Status 之外补两类只读语义（成功/进行中） */
export type BadgeStatus = Status | 'success' | 'info'
```
