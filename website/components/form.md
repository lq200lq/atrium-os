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

## 控件来源（S9 收口）

`OsForm` 的每种 `type` 都渲染 `src/ui` 里的同名控件，**不再有内联裸标签**：`input` → `OsInput`、`textarea` → `OsTextarea`、`select` → `OsSelect`、`switch` → `OsSwitch`、`checkbox` → `OsCheckbox`、`radio` → `OsRadio`。因此表单里的控件天然继承下面三件的 size/status/disabled 契约。

## OsTextarea 多行输入

| 名称          | 类型                              | 默认        | 说明                                                                                                  |
| ------------- | --------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------- |
| `rows`        | `number`                          | `3`         | 初始行数；开 `autosize` 时充当高度下界                                                                |
| `autosize`    | `boolean \| { minRows, maxRows }` | `false`     | 自适应高度。硬换行按行数立即生效，软换行由渲染后实测 `scrollHeight` 修正；`minRows` 缺省回落到 `rows` |
| `showCount`   | `boolean`                         | `false`     | 右下角字数；**传了 `maxLength` 也会显示**（`n / max`）                                                |
| `maxLength`   | `number`                          | —           | 原生上限                                                                                              |
| `placeholder` | `string`                          | `''`        | 占位                                                                                                  |
| `size`        | `Size`                            | `'md'`      | **只驱动内边距刻度**：多行件的高度属于 `rows`/`autosize` 语义，不进 §3.4 控件高表                     |
| `disabled`    | `boolean`                         | `false`     | `is-disabled` 唯一写法                                                                                |
| `status`      | `Status`                          | `'default'` | error/warning 描边 + 状态环                                                                           |

Model：`v-model: string`。计数是纯数字（`12` 或 `12 / 200`），不含需翻译的量词，故不走 i18n。

## OsInputNumber 数值输入

| 名称          | 类型      | 默认        | 说明                                                                                                 |
| ------------- | --------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| `step`        | `number`  | `1`         | 步进（↑/↓ 与两侧按钮共用）                                                                           |
| `min` / `max` | `number`  | —           | 越界自动钳制，按钮在边界禁用                                                                         |
| `precision`   | `number`  | —           | 显示与提交值保留的小数位；不给则不额外取整（步进内部用 `toPrecision(12)` 抹掉 0.1+0.2 这类浮点尾差） |
| `placeholder` | `string`  | `''`        | 占位                                                                                                 |
| `size`        | `Size`    | `'md'`      | 高度取 `h-control-*`                                                                                 |
| `disabled`    | `boolean` | `false`     | 同时落原生 `disabled`                                                                                |
| `status`      | `Status`  | `'default'` | 与 `OsInput` 同一组语义刻度类                                                                        |

Model：`v-model: number | undefined`（清空即为 `undefined`，不用 `0` 或 `NaN` 冒充空值）。**逐键不写回**：文本态在组件内，`change`/`blur` 时才提交并钳制，非法片段直接回退到上一个合法值——边输入边校验不会打断手感。↑/↓ 键与右侧上下钮共用 `step`。

## 校验

- 校验失败文案走 i18n `validation.*`（`required`/`minLen`/`maxLen`/`pattern`/`minNum`/`maxNum`），以 `{label}`/`{min}`/`{max}` 插值。
- 必填星号用 `<span class="text-danger">*</span>` 渲染。
- 校验全部通过才派发 `submit`。

## 用法

```vue
<OsForm v-model="values" :fields="fields" @submit="onSubmit" />
```
