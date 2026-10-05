<!-- 由 scripts/gen-api-tables.mjs 从 OsSelect.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `options` | `SelectOption[]` | 是 | — | 选项列表（value/label）；空数组时仅剩占位项，不可选 |
| `placeholder` | `string` | 否 | `'请选择'` | 非空时渲染为 disabled 占位 option；默认值 '请选择' 是写死的中文、不走 i18n，传空串可关掉 |
| `size` | `Size` | 否 | `'md'` | 高度/内边距走控件刻度（ControlShell） |
| `disabled` | `boolean` | 否 | `false` | is-disabled 唯一写法；同时落原生 disabled |
| `loading` | `boolean` | 否 | `false` | 后缀区追加旋转 loader 指示；只影响外观，不禁用选择 |
| `status` | `Status` | 否 | `'default'` | error/warning 描边 + 状态环，default 走中性描边 |

**Model**

| 绑定 | 类型 | 默认 |
| --- | --- | --- |
| `v-model` | `string` | `''` |

**引用类型**（`src/ui/types.ts`）

```ts
export interface SelectOption {
  value: string
  label: string
}
/** 控件尺寸档位：数值来自 --control-height-* 刻度（24 / 28 / 32） */
export type Size = 'sm' | 'md' | 'lg'
/** 录入类控件的校验状态；非 default 时描边与状态环由语义色刻度派生 */
export type Status = 'default' | 'error' | 'warning'
```
