<!-- 由 scripts/gen-api-tables.mjs 从 OsAvatar.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `src` | `string` | 否 | `''` | 图片地址；加载 error 后自动回退到 text/icon 分支（imgFailed 置位） |
| `alt` | `string` | 否 | `''` | img 的 alt 文本；仅在图片分支生效，text/icon 回退时不使用 |
| `text` | `string` | 否 | `''` | 无图时显示文本（首字母等），再缺省回退图标 |
| `icon` | `IconName` | 否 | `'user'` | src 与 text 都不可用时的兜底图标；sm 档 12px、其余 16px |
| `size` | `Size` | 否 | `'md'` | 直径复用控件高度刻度（24/28/32），aspect-square 保持圆形 |

**引用类型**（`src/ui/types.ts`）

```ts
/** 控件尺寸档位：数值来自 --control-height-* 刻度（24 / 28 / 32） */
export type Size = 'sm' | 'md' | 'lg'
```
