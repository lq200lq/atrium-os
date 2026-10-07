<!-- 由 scripts/gen-api-tables.mjs 从 OsSwitch.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `disabled` | `boolean` | 否 | `false` | 禁用切换并落原生 disabled |
| `label` | `string` | 否 | `''` | 右侧说明文字；非空才渲染。button 非可标注元素，点击文本不会切换开关 |
| `ariaLabel` | `string` | 否 | `undefined` | 可访问名称：套在外层 label 里或只渲染开关本体时必传——与 OsSelect/OsInput 的 ariaLabel 同一契约 |
| `status` | `Status` | 否 | `'default'` | 非 default 时给开关本体加语义描边 + 状态环（default 态无描边，与 Input 家族不同） |

**Model**

| 绑定 | 类型 | 默认 |
| --- | --- | --- |
| `v-model` | `boolean` | — |

**引用类型**（`src/ui/types.ts`）

```ts
/** 录入类控件的校验状态；非 default 时描边与状态环由语义色刻度派生 */
export type Status = 'default' | 'error' | 'warning'
```
