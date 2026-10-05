<!-- 由 scripts/gen-api-tables.mjs 从 OsSkeleton.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `variant` | `'text' \| 'rect' \| 'circle'` | 否 | `'text'` | text：多行文本骨架；rect：单块矩形；circle：头像圆 |
| `rows` | `number` | 否 | `3` | 行数，仅 text 变体消费（rect/circle 忽略）；末行自动收窄为 2/3 宽 |
