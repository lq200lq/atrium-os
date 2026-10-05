<!-- 由 scripts/gen-api-tables.mjs 从 OsInput.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `placeholder` | `string` | 否 | `''` | 占位文字 |
| `size` | `Size` | 否 | `'md'` | 高度/内边距走控件刻度（ControlShell） |
| `disabled` | `boolean` | 否 | `false` | is-disabled 唯一写法；同时落原生 disabled |
| `status` | `Status` | 否 | `'default'` | error/warning 描边 + 状态环，default 走中性描边 |
| `clearable` | `boolean` | 否 | `false` | 值非空时在后缀区显示 ×，点击清空 v-model 并派发 clear；与 suffix 插槽共存 |

**Model**

| 绑定 | 类型 | 默认 |
| --- | --- | --- |
| `v-model` | `string` | `''` |

**Emits**

| 事件 | 载荷 | 说明 |
| --- | --- | --- |
| `enter` | — | Enter 键按下时派发（keydown.enter），组件自身不做提交 |
| `esc` | — | Esc 键按下时派发（keydown.esc） |
| `clear` | — | 点击 clearable 的 × 时派发；发出前 v-model 已置为空串 |

**Slots**

- `prefix`
- `suffix`

**引用类型**（`src/ui/types.ts`）

```ts
/** 控件尺寸档位：数值来自 --control-height-* 刻度（24 / 28 / 32） */
export type Size = 'sm' | 'md' | 'lg'
/** 录入类控件的校验状态；非 default 时描边与状态环由语义色刻度派生 */
export type Status = 'default' | 'error' | 'warning'
```
