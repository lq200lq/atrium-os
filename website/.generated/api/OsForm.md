<!-- 由 scripts/gen-api-tables.mjs 从 OsForm.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `fields` | `FormField[]` | 是 | — | 字段定义，驱动渲染与校验；可用 `field-<key>` 具名插槽完全自定义某字段控件 |
| `layout` | `'horizontal' \| 'vertical' \| 'inline'` | 否 | `'vertical'` | vertical/horizontal 纵向或左右排布；inline 时字段横向换行平铺、提交按钮跟在字段之后 |
| `disabled` | `boolean` | 否 | `false` | 整体禁用：透传所有字段控件与提交按钮；不拦截暴露的 validate() 调用 |
| `labelWidth` | `string` | 否 | `'88px'` | 标签列宽（CSS 长度串），仅 horizontal 布局使用 |
| `submitText` | `string` | 否 | `''` | 提交按钮文案，空串回退 common.submit；提供 actions 插槽时按钮整体被插槽替换 |

**Model**

| 绑定 | 类型 | 默认 |
| --- | --- | --- |
| `v-model` | `Record<string, unknown>` | — |

**Emits**

| 事件 | 载荷 | 说明 |
| --- | --- | --- |
| `submit` | `values: Record<string, unknown>` | 全部字段校验通过后派发（载荷为表单值对象浅拷贝）；有失败项时不派发并就地显示错误文案 |

**Slots**

- `default`
- `actions`

**引用类型**（`src/ui/types.ts`）

```ts
export interface FormField {
  key: string
  label: string
  type: FieldType
  options?: { value: string; label: string }[]
  placeholder?: string
  required?: boolean
  /** number 类型校验数值上下界；string 类型校验长度上下界 */
  min?: number
  max?: number
  pattern?: string
  /** 自定义校验失败文案 */
  message?: string
}
```
