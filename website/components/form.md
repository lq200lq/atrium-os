# OsForm 表单

声明式表单：字段定义驱动渲染与校验，`v-model` 托管整个值对象。

## Props

| 名称         | 类型                                     | 默认         | 说明                                   |
| ------------ | ---------------------------------------- | ------------ | -------------------------------------- |
| `fields`     | `FormField[]`                            | —            | 字段定义（必填）                       |
| `layout`     | `'horizontal' \| 'vertical' \| 'inline'` | `'vertical'` | 布局方向                               |
| `disabled`   | `boolean`                                | `false`      | 整体禁用                               |
| `labelWidth` | `string`                                 | `'88px'`     | horizontal 布局下标签宽度              |
| `submitText` | `string`                                 | `''`         | 提交按钮文案，空串回退 `common.submit` |

## Model

| 名称      | 类型                      | 说明               |
| --------- | ------------------------- | ------------------ |
| `v-model` | `Record<string, unknown>` | 表单值对象（必填） |

## Emits

| 事件     | 载荷                              | 说明           |
| -------- | --------------------------------- | -------------- |
| `submit` | `values: Record<string, unknown>` | 校验通过后派发 |

## FormField

```ts
type FieldType = 'input' | 'textarea' | 'select' | 'switch' | 'checkbox' | 'radio'

interface FormField {
  key: string
  label: string
  type: FieldType
  options?: { value: string; label: string }[] // select/radio 用
  placeholder?: string
  required?: boolean
  min?: number // number 类型校验数值下界；string 类型校验长度下界
  max?: number // 同上，上界
  pattern?: string
  message?: string // 自定义校验失败文案
}
```

## 校验

- 校验失败文案走 i18n `validation.*`（`required`/`minLen`/`maxLen`/`pattern`/`minNum`/`maxNum`），以 `{label}`/`{min}`/`{max}` 插值。
- 必填星号用 `<span class="text-danger">*</span>` 渲染。
- 校验全部通过才派发 `submit`。

## 用法

```vue
<OsForm v-model="values" :fields="fields" @submit="onSubmit" />
```
