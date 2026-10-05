<!-- 由 scripts/gen-api-tables.mjs 从 OsTag.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `status` | `BadgeStatus` | 否 | `'default'` | 五档预设 tint：描边/浅底/前景同色族（default/error/warning/success/info） |
| `bordered` | `boolean` | 否 | `true` | 关闭描边时改用透明边框占位，盒子尺寸不变 |
| `closable` | `boolean` | 否 | `false` | 尾部 × 按钮（10px），aria-label 走 common.close；点击派发 close |
| `icon` | `IconName` | 否 | `undefined` | 前置图标（固定 12px），缺省不渲染图标位 |

**Emits**

| 事件 | 载荷 | 说明 |
| --- | --- | --- |
| `close` | — | 点击 closable 渲染的尾部 × 时派发；组件自身不负责移除标签 |

**Slots**

- `default`

**引用类型**（`src/ui/types.ts`）

```ts
/** 展示型徽标语义：Status 之外补两类只读语义（成功/进行中） */
export type BadgeStatus = Status | 'success' | 'info'
```
