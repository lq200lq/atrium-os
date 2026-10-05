<!-- 由 scripts/gen-api-tables.mjs 从 OsSpace.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `direction` | `SpaceDirection` | 否 | `'row'` | flex 主轴方向，column 时子项纵向堆叠 |
| `size` | `GapSize` | 否 | `'sm'` | 相邻子项间隙，与 OsGrid gap 同用 GapSize 七档刻度 |
| `align` | `SpaceAlign` | 否 | `'start'` | 交叉轴对齐（items 语义），不影响主轴排布 |
| `wrap` | `boolean` | 否 | `false` | 允许换行（flex-wrap） |

**Slots**

- `default`

**引用类型**（`src/ui/types.ts`）

```ts
/** S9 布局件共用：间距档（4px 网格刻度名） */
export type GapSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type SpaceAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline'
export type SpaceDirection = 'row' | 'column'
```
