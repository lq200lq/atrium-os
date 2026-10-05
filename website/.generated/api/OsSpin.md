<!-- 由 scripts/gen-api-tables.mjs 从 OsSpin.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `loading` | `boolean` | 否 | `true` | 缺省 true：内联型挂载即转（可纯当指示器用）；容器型以此控制遮罩显隐 |
| `size` | `Size` | 否 | `undefined` | 直径走 h-control-* 刻度；缺省可被 OsConfigProvider 的 size 覆盖 |
| `tip` | `string` | 否 | `''` |  |

**Slots**

- `default`

**引用类型**（`src/ui/types.ts`）

```ts
/** 控件尺寸档位：数值来自 --control-height-* 刻度（24 / 28 / 32） */
export type Size = 'sm' | 'md' | 'lg'
```
