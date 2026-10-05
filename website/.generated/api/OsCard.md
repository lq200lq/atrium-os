<!-- 由 scripts/gen-api-tables.mjs 从 OsCard.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `title` | `string` | 否 | `''` | 标题文字；仅作 title 插槽缺省内容（未提供插槽时显示）。title/extra 任一存在即渲染标题行 |
| `bordered` | `boolean` | 否 | `true` | 是否描边（border-line）；关掉后阴影与圆角保留 |
| `padded` | `boolean` | 否 | `true` | 内容区是否套用 md 内边距；嵌表格/图片等铺满件时关掉 |

**Slots**

- `default`
- `title`
- `extra`
- `footer`
