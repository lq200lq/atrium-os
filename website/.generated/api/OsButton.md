<!-- 由 scripts/gen-api-tables.mjs 从 OsButton.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `variant` | `'primary' \| 'ghost' \| 'danger'` | 否 | `'ghost'` | primary 实底 / ghost 描边（默认） / danger 红字描边；无 text 档 |
| `size` | `Size` | 否 | `'md'` | 高度与内边距同档联动（h-control-* + px-*） |
| `disabled` | `boolean` | 否 | `false` | 落原生 disabled，鼠标态走 is-disabled 唯一写法 |
| `loading` | `boolean` | 否 | `false` | 前置等宽 spinner（防文案跳动），自动禁用点击并置 aria-busy |

**Slots**

- `default`

**引用类型**（`src/ui/types.ts`）

```ts
/** 控件尺寸档位：数值来自 --control-height-* 刻度（24 / 28 / 32） */
export type Size = 'sm' | 'md' | 'lg'
```
