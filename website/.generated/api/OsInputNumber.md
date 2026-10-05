<!-- 由 scripts/gen-api-tables.mjs 从 OsInputNumber.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `step` | `number` | 否 | `1` | 步进量：↑/↓ 方向键与右侧上下钮共用；步进内部 toPrecision(12) 抹浮点尾差 |
| `min` | `number` | 否 | `undefined` | 数值下界：提交与步进时钳制，到界时下钮禁用 |
| `max` | `number` | 否 | `undefined` | 数值上界：提交与步进时钳制，到界时上钮禁用 |
| `precision` | `number` | 否 | `undefined` | 显示与提交值保留的小数位 |
| `placeholder` | `string` | 否 | `''` | 占位文字 |
| `size` | `Size` | 否 | `'md'` | 高度/内边距走控件刻度（ControlShell） |
| `disabled` | `boolean` | 否 | `false` | 禁用输入、上下钮与步进键，同时落原生 disabled |
| `status` | `Status` | 否 | `'default'` | 与 OsInput 同一组语义刻度描边/状态环 |

**Model**

| 绑定 | 类型 | 默认 |
| --- | --- | --- |
| `v-model` | `number \| undefined` | — |

**引用类型**（`src/ui/types.ts`）

```ts
/** 控件尺寸档位：数值来自 --control-height-* 刻度（24 / 28 / 32） */
export type Size = 'sm' | 'md' | 'lg'
/** 录入类控件的校验状态；非 default 时描边与状态环由语义色刻度派生 */
export type Status = 'default' | 'error' | 'warning'
```
