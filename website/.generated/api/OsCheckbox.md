<!-- 由 scripts/gen-api-tables.mjs 从 OsCheckbox.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `disabled` | `boolean` | 否 | `false` | 落原生 disabled，勾选框与 label 文本一并失效 |
| `label` | `string` | 否 | `''` | 相邻文案；input 可被 label 关联，点击文本等同勾选切换 |
| `status` | `Status` | 否 | `'default'` | 非 default 时给勾选框加语义描边 + 状态环 |

**Model**

| 绑定 | 类型 | 默认 |
| --- | --- | --- |
| `v-model` | `boolean` | — |

**引用类型**（`src/ui/types.ts`）

```ts
/** 录入类控件的校验状态；非 default 时描边与状态环由语义色刻度派生 */
export type Status = 'default' | 'error' | 'warning'
```
