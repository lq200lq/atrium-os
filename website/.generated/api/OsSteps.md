<!-- 由 scripts/gen-api-tables.mjs 从 OsSteps.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `items` | `StepItem[]` | 是 | — | 步骤定义（title 必填，description 可选）；顺序即流程 |
| `error` | `boolean` | 否 | `false` | true 时当前步呈现 error 态而非 process 态；其余步仍由 current 推导 finish/wait |

**Model**

| 绑定 | 类型 | 默认 |
| --- | --- | --- |
| `v-model:current` | `number` | `0` |

**Emits**

| 事件 | 载荷 | 说明 |
| --- | --- | --- |
| `change` | `index: number` | 点击非当前步时派发；载荷为目标索引（v-model:current 同时写回） |

**引用类型**（`src/ui/types.ts`）

```ts
/** OsSteps 单步定义；title 必填，description 可选补充说明 */
export interface StepItem {
  title: string
  description?: string
}
```
