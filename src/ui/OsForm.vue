<script setup lang="ts">
import { reactive } from 'vue'
import { useText } from './internal/text'
import type { FormField, Status } from './types'
import OsButton from './OsButton.vue'
import OsInput from './OsInput.vue'
import OsSelect from './OsSelect.vue'
import OsSwitch from './OsSwitch.vue'
import OsCheckbox from './OsCheckbox.vue'
import OsRadio from './OsRadio.vue'
import OsTextarea from './OsTextarea.vue'

export type { FieldType, FormField } from './types'

const props = withDefaults(
  defineProps<{
    /** 字段定义，驱动渲染与校验；可用 `field-<key>` 具名插槽完全自定义某字段控件 */
    fields: FormField[]
    /** vertical/horizontal 纵向或左右排布；inline 时字段横向换行平铺、提交按钮跟在字段之后 */
    layout?: 'horizontal' | 'vertical' | 'inline'
    /** 整体禁用：透传所有字段控件与提交按钮；不拦截暴露的 validate() 调用 */
    disabled?: boolean
    /** 标签列宽（CSS 长度串），仅 horizontal 布局使用 */
    labelWidth?: string
    /** 提交按钮文案，空串回退 common.submit；提供 actions 插槽时按钮整体被插槽替换 */
    submitText?: string
  }>(),
  { layout: 'vertical', disabled: false, labelWidth: '88px', submitText: '' },
)

const emit = defineEmits<{
  /** 全部字段校验通过后派发（载荷为表单值对象浅拷贝）；有失败项时不派发并就地显示错误文案 */
  submit: [values: Record<string, unknown>]
}>()
const model = defineModel<Record<string, unknown>>({ required: true })
const { t } = useText()

const errors = reactive<Record<string, string>>({})

function valueOf(key: string): unknown {
  return model.value[key]
}

function setField(key: string, v: unknown) {
  model.value = { ...model.value, [key]: v }
}

function validateField(field: FormField): string {
  const v = valueOf(field.key)
  const label = field.label
  const empty = v === undefined || v === null || v === '' || v === false
  if (field.required && empty) return field.message ?? t('validation.required', { label })
  if (empty) return ''
  if (typeof v === 'string') {
    if (field.min !== undefined && v.length < field.min)
      return field.message ?? t('validation.minLen', { label, min: field.min })
    if (field.max !== undefined && v.length > field.max)
      return field.message ?? t('validation.maxLen', { label, max: field.max })
    if (field.pattern && !new RegExp(field.pattern).test(v))
      return field.message ?? t('validation.pattern', { label })
  }
  if (typeof v === 'number') {
    if (field.min !== undefined && v < field.min)
      return field.message ?? t('validation.minNum', { label, min: field.min })
    if (field.max !== undefined && v > field.max)
      return field.message ?? t('validation.maxNum', { label, max: field.max })
  }
  return ''
}

function validate(): boolean {
  let ok = true
  for (const f of props.fields) {
    const msg = validateField(f)
    if (msg) {
      errors[f.key] = msg
      ok = false
    } else {
      delete errors[f.key]
    }
  }
  return ok
}

function onSubmit() {
  if (validate()) emit('submit', { ...model.value })
}

/** 校验失败 → 控件 status：描边/状态环仍由刻度表派生，表单不自写样式 */
function fieldStatus(key: string): Status {
  return errors[key] ? 'error' : 'default'
}

defineExpose({ validate, errors })
</script>

<template>
  <form
    class="text-ui text-ink"
    :class="layout === 'inline' ? 'flex flex-wrap items-end gap-3' : 'flex flex-col gap-3'"
    @submit.prevent="onSubmit"
  >
    <div
      v-for="field in fields"
      :key="field.key"
      :class="[
        layout === 'vertical' && 'flex flex-col gap-1',
        layout === 'horizontal' && 'flex items-start gap-2',
        layout === 'inline' && 'flex flex-col gap-1',
      ]"
    >
      <label
        v-if="field.type !== 'checkbox'"
        class="shrink-0 text-ink"
        :class="layout === 'horizontal' && 'pt-2xs text-right'"
        :style="layout === 'horizontal' ? { width: labelWidth } : undefined"
      >
        {{ field.label }}<span v-if="field.required" class="text-danger-text">*</span>
      </label>

      <div class="min-w-0" :class="layout !== 'vertical' && 'flex-1'">
        <!-- 逃生口：具名插槽 field-<key> 完全自定义该字段控件 -->
        <slot :name="`field-${field.key}`" :field="field" :model="model" :error="errors[field.key]">
          <OsInput
            v-if="field.type === 'input'"
            :model-value="String(valueOf(field.key) ?? '')"
            :placeholder="field.placeholder"
            :disabled="disabled"
            :status="fieldStatus(field.key)"
            @update:model-value="setField(field.key, $event)"
          />
          <OsTextarea
            v-else-if="field.type === 'textarea'"
            :model-value="String(valueOf(field.key) ?? '')"
            :placeholder="field.placeholder"
            :disabled="disabled"
            :status="fieldStatus(field.key)"
            autosize
            :rows="3"
            @update:model-value="setField(field.key, $event)"
          />
          <OsSelect
            v-else-if="field.type === 'select'"
            :model-value="String(valueOf(field.key) ?? '')"
            :options="field.options ?? []"
            :placeholder="field.placeholder"
            :disabled="disabled"
            :status="fieldStatus(field.key)"
            @update:model-value="setField(field.key, $event)"
          />
          <OsSwitch
            v-else-if="field.type === 'switch'"
            :model-value="Boolean(valueOf(field.key))"
            :disabled="disabled"
            :status="fieldStatus(field.key)"
            @update:model-value="setField(field.key, $event)"
          />
          <OsCheckbox
            v-else-if="field.type === 'checkbox'"
            :model-value="Boolean(valueOf(field.key))"
            :label="field.label"
            :disabled="disabled"
            :status="fieldStatus(field.key)"
            @update:model-value="setField(field.key, $event)"
          />
          <OsRadio
            v-else-if="field.type === 'radio'"
            :model-value="String(valueOf(field.key) ?? '')"
            :options="field.options ?? []"
            :name="field.key"
            :disabled="disabled"
            :status="fieldStatus(field.key)"
            @update:model-value="setField(field.key, $event)"
          />
        </slot>
        <p v-if="errors[field.key]" class="mt-1 text-caption text-danger-text">
          {{ errors[field.key] }}
        </p>
      </div>
    </div>

    <div :class="layout === 'inline' ? '' : 'mt-1 flex justify-end gap-2'">
      <slot name="actions">
        <OsButton type="submit" variant="primary" :disabled="disabled">{{
          submitText || t('common.submit')
        }}</OsButton>
      </slot>
    </div>
  </form>
</template>
