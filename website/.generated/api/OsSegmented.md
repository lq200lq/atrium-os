<!-- 由 scripts/gen-api-tables.mjs 从 OsSegmented.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `options` | `SegmentedOption[]` | 是 | — | 分段定义（value/label/icon）；icon 为可选项，缺省该段只渲染 label |
| `label` | `string` | 否 | `''` | 可访问名：radiogroup 缺少可见标题时必传 |
| `size` | `Size` | 否 | `undefined` | 段高走 h-control-* 刻度；字号/内边距不随档变化；缺省可被 OsConfigProvider 的 size 覆盖 |
| `disabled` | `boolean` | 否 | `false` | 整组禁用：各段原生 disabled，方向键导航同时失效 |
| `block` | `boolean` | 否 | `false` | true 时铺满容器，各段等宽 |

**Model**

| 绑定 | 类型 | 默认 |
| --- | --- | --- |
| `v-model` | `string` | — |

**Slots**

- `option-prefix`

**引用类型**（`src/ui/types.ts`）

```ts
/** OsSegmented 选项；icon 缺省时只渲染 label */
export interface SegmentedOption {
  value: string
  label: string
  icon?: IconName
}
/** 控件尺寸档位：数值来自 --control-height-* 刻度（24 / 28 / 32） */
export type Size = 'sm' | 'md' | 'lg'
```
