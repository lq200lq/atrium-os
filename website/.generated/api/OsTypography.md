<!-- 由 scripts/gen-api-tables.mjs 从 OsTypography.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `type` | `TypographyType` | 否 | `'text'` | 字阶与语义标签；只渲染 p（link 且有 href 时为 a），不产出 h* 标题，进标题树请用容器标题 |
| `href` | `string` | 否 | `''` | link 型的跳转目标 |
| `strong` | `boolean` | 否 | `false` | 在字阶之上追加 font-strong（600）；title 档自带加粗，无需重复开启 |
| `disabled` | `boolean` | 否 | `false` | 仅叠加 is-disabled 样式（降透明度 + not-allowed 光标），不拦截链接点击等交互 |
| `status` | `Status` | 否 | `'default'` | 非 default 时用 error/warning 语义色覆盖前景，优先级高于 link 的 accent 色 |
| `ellipsis` | `boolean` | 否 | `false` | 行裁剪（line-clamp，档位在 1–4）；配合 expandable 展开后解除裁剪 |
| `rows` | `1 \| 2 \| 3 \| 4` | 否 | `1` | 裁剪行数；仅在 ellipsis 开启时生效 |
| `expandable` | `boolean` | 否 | `false` | 省略后追加「展开/收起」切换 |

**Slots**

- `default`

**引用类型**（`src/ui/types.ts`）

```ts
/** 录入类控件的校验状态；非 default 时描边与状态环由语义色刻度派生 */
export type Status = 'default' | 'error' | 'warning'
export type TypographyType = 'text' | 'title' | 'paragraph' | 'link'
```
