<!-- 由 scripts/gen-api-tables.mjs 从 OsGrid.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `columns` | `GridColumns` | 否 | `3` | 宽窗口（w-wide，≥800px）下的列数；narrow/mid 按 COLUMNS_CLASS 档位自动降档 |
| `gap` | `GapSize` | 否 | `'md'` | 行列间隙，与 OsSpace size 同用 GapSize 刻度 |

**Slots**

- `default`

**引用类型**（`src/ui/types.ts`）

```ts
/** S9 布局件共用：间距档（4px 网格刻度名） */
export type GapSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
/** OsGrid 列数上限；按窗口宽度（w-narrow/mid/wide）降档 */
export type GridColumns = 1 | 2 | 3 | 4 | 5 | 6
```
