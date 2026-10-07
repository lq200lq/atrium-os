# OsForm 表单

声明式表单：字段定义驱动渲染与校验，`v-model` 托管整个值对象。

## API

<!--@include: ../.generated/api/OsForm.md -->

## 控件来源（S9 收口）

`OsForm` 的每种 `type` 都渲染 `src/ui` 里的同名控件，**不再有内联裸标签**：`input` → `OsInput`、`textarea` → `OsTextarea`、`select` → `OsSelect`、`switch` → `OsSwitch`、`checkbox` → `OsCheckbox`、`radio` → `OsRadio`。因此表单里的控件天然继承下面各件的 size/status/disabled 契约。

## OsInput 文本输入

<!--@include: ../.generated/api/OsInput.md -->

`enter`/`esc` 只是按键的转发事件，组件自身不做提交；提交语义留给调用方或 `OsForm`。

## OsTextarea 多行输入

<!--@include: ../.generated/api/OsTextarea.md -->

计数是纯数字（`12` 或 `12 / 200`），不含需翻译的量词，故不走 i18n。

## OsInputNumber 数值输入

<!--@include: ../.generated/api/OsInputNumber.md -->

清空即为 `undefined`，不用 `0` 或 `NaN` 冒充空值。**逐键不写回**：文本态在组件内，`change`/`blur` 时才提交并钳制，非法片段直接回退到上一个合法值——边输入边校验不会打断手感。

## OsSelect 下拉选择

<!--@include: ../.generated/api/OsSelect.md -->

## OsSwitch 开关

<!--@include: ../.generated/api/OsSwitch.md -->

## OsRadio 单选组

<!--@include: ../.generated/api/OsRadio.md -->

## OsCheckbox 复选框

<!--@include: ../.generated/api/OsCheckbox.md -->

## 校验

- 校验失败文案走 i18n `validation.*`（`required`/`minLen`/`maxLen`/`pattern`/`minNum`/`maxNum`），以 `{label}`/`{min}`/`{max}` 插值。
- 必填星号用 `<span class="text-danger-text">*</span>` 渲染（`text-danger` 是 seed，对表面仅 3.67:1 不达 AA）。
- 校验全部通过才派发 `submit`。

## 用法

```vue
<OsForm v-model="values" :fields="fields" @submit="onSubmit" />
```
