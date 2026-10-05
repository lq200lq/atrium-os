<!-- 由 scripts/gen-api-tables.mjs 从 OsTextarea.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `rows` | `number` | 否 | `3` | 初始行数；开 autosize 时充当高度下界（minRows 缺省回落到 rows） |
| `autosize` | `boolean \| TextareaAutosize` | 否 | `false` | 自适应高度：硬换行按行数立即生效，软换行由渲染后实测 scrollHeight 修正；对象形态给 minRows/maxRows 边界 |
| `showCount` | `boolean` | 否 | `false` | 右下角字数；不传但给了 maxLength 时同样显示（n / max 形式） |
| `maxLength` | `number` | 否 | `undefined` | 原生 maxlength 硬上限；提供即强制显示字数（见 showCount） |
| `placeholder` | `string` | 否 | `''` | 占位文字 |
| `size` | `Size` | 否 | `'md'` | 只驱动内边距刻度；多行件高度属于 rows/autosize 语义，不进控件高表 |
| `disabled` | `boolean` | 否 | `false` | is-disabled 唯一写法；同时落原生 disabled |
| `status` | `Status` | 否 | `'default'` | error/warning 描边 + 状态环，default 走中性描边 |

**Model**

| 绑定 | 类型 | 默认 |
| --- | --- | --- |
| `v-model` | `string` | `''` |

**引用类型**（`src/ui/types.ts`）

```ts
/** 控件尺寸档位：数值来自 --control-height-* 刻度（24 / 28 / 32） */
export type Size = 'sm' | 'md' | 'lg'
/** 录入类控件的校验状态；非 default 时描边与状态环由语义色刻度派生 */
export type Status = 'default' | 'error' | 'warning'
/** OsTextarea 自适应高度边界（行数）；提供 autosize 对象时按此钳制 */
export interface TextareaAutosize {
  minRows?: number
  maxRows?: number
}
```
