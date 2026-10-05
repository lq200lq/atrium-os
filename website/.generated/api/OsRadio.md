<!-- 由 scripts/gen-api-tables.mjs 从 OsRadio.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `options` | `RadioOption[]` | 是 | — | 选项列表；选中项的 value 写回 v-model，label 显示于圆点旁 |
| `name` | `string` | 否 | `undefined` | 原生 name（浏览器互斥分组）；缺省按实例自动生成唯一组名，同页多组互不串味 |
| `disabled` | `boolean` | 否 | `false` | 整组禁用：每项落原生 disabled，选中不变 |
| `status` | `Status` | 否 | `'default'` | 非 default 时每个圆点加语义描边 + 状态环 |

**Model**

| 绑定 | 类型 | 默认 |
| --- | --- | --- |
| `v-model` | `string` | — |

**引用类型**（`src/ui/types.ts`）

```ts
export interface RadioOption {
  value: string
  label: string
}
/** 录入类控件的校验状态；非 default 时描边与状态环由语义色刻度派生 */
export type Status = 'default' | 'error' | 'warning'
```
