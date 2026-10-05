<!-- 由 scripts/gen-api-tables.mjs 从 OsConfigProvider.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `locale` | `Locale` | 否 | — | 子树内组件内建文案的语言。 |
| `size` | `Size` | 否 | — | 子树内控件的缺省尺寸。 |
| `accent` | `string` | 否 | — | 子树内的强调色预设（sky/violet/emerald/rose，与全局设置为同一批预设）。 |
| `controlHeight` | `Partial<Record<Size, string>>` | 否 | — | 子树内的控件高度刻度覆盖。 |
| `radius` | `Partial<Record<'chip' \| 'control' \| 'surface' \| 'panel', string>>` | 否 | — | 子树内的圆角刻度覆盖。 |

**Slots**

- `default`

**引用类型**（`src/ui/types.ts`）

```ts
/** 控件尺寸档位：数值来自 --control-height-* 刻度（24 / 28 / 32） */
export type Size = 'sm' | 'md' | 'lg'
```
