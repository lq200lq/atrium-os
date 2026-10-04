<script setup lang="ts">
import { reactive } from 'vue'
import OsButton from './OsButton.vue'
import OsInput from './OsInput.vue'
import OsSelect from './OsSelect.vue'
import OsSwitch from './OsSwitch.vue'
import OsCheckbox from './OsCheckbox.vue'
import OsRadio from './OsRadio.vue'

export type FieldType = 'input' | 'textarea' | 'select' | 'switch' | 'checkbox' | 'radio'

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

const props = withDefaults(
  defineProps<{
    fields: FormField[]
    layout?: 'horizontal' | 'vertical' | 'inline'
    disabled?: boolean
    labelWidth?: string
    submitText?: string
  }>(),
  { layout: 'vertical', disabled: false, labelWidth: '88px', submitText: '提交' },
)

const emit = defineEmits<{ submit: [values: Record<string, unknown>] }>()
const model = defineModel<Record<string, unknown>>({ required: true })

const errors = reactive<Record<string, string>>({})

function valueOf(key: string): unknown {
  return model.value[key]
}

function setField(key: string, v: unknown) {
  model.value = { ...model.value, [key]: v }
}

function validateField(field: FormField): string {
  const v = valueOf(field.key)
  const empty = v === undefined || v === null || v === '' || v === false
  if (field.required && empty) return field.message ?? `${field.label}不能为空`
  if (empty) return ''
  if (typeof v === 'string') {
    if (field.min !== undefined && v.length < field.min)
      return field.message ?? `${field.label}至少 ${field.min} 个字符`
    if (field.max !== undefined && v.length > field.max)
      return field.message ?? `${field.label}至多 ${field.max} 个字符`
    if (field.pattern && !new RegExp(field.pattern).test(v))
      return field.message ?? `${field.label}格式不正确`
  }
  if (typeof v === 'number') {
    if (field.min !== undefined && v < field.min)
      return field.message ?? `${field.label}不得小于 ${field.min}`
    if (field.max !== undefined && v > field.max)
      return field.message ?? `${field.label}不得大于 ${field.max}`
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
        :class="layout === 'horizontal' && 'pt-1.5 text-right'"
        :style="layout === 'horizontal' ? { width: labelWidth } : undefined"
      >
        {{ field.label }}<span v-if="field.required" class="text-danger">*</span>
      </label>

      <div class="min-w-0" :class="layout !== 'vertical' && 'flex-1'">
        <!-- 逃生口：具名插槽 field-<key> 完全自定义该字段控件 -->
        <slot :name="`field-${field.key}`" :field="field" :model="model" :error="errors[field.key]">
          <OsInput
            v-if="field.type === 'input'"
            :model-value="String(valueOf(field.key) ?? '')"
            :placeholder="field.placeholder"
            :disabled="disabled"
            @update:model-value="setField(field.key, $event)"
          />
          <textarea
            v-else-if="field.type === 'textarea'"
            class="w-full rounded-md border border-slate-200 px-3 py-1.5 text-ui text-ink outline-none focus:border-accent"
            :placeholder="field.placeholder"
            :disabled="disabled"
            rows="3"
            :value="String(valueOf(field.key) ?? '')"
            @input="setField(field.key, ($event.target as HTMLTextAreaElement).value)"
          />
          <OsSelect
            v-else-if="field.type === 'select'"
            :model-value="String(valueOf(field.key) ?? '')"
            :options="field.options ?? []"
            :placeholder="field.placeholder"
            :disabled="disabled"
            @update:model-value="setField(field.key, $event)"
          />
          <OsSwitch
            v-else-if="field.type === 'switch'"
            :model-value="Boolean(valueOf(field.key))"
            :disabled="disabled"
            @update:model-value="setField(field.key, $event)"
          />
          <OsCheckbox
            v-else-if="field.type === 'checkbox'"
            :model-value="Boolean(valueOf(field.key))"
            :label="field.label"
            :disabled="disabled"
            @update:model-value="setField(field.key, $event)"
          />
          <OsRadio
            v-else-if="field.type === 'radio'"
            :model-value="String(valueOf(field.key) ?? '')"
            :options="field.options ?? []"
            :name="field.key"
            :disabled="disabled"
            @update:model-value="setField(field.key, $event)"
          />
        </slot>
        <p v-if="errors[field.key]" class="mt-1 text-caption text-danger">
          {{ errors[field.key] }}
        </p>
      </div>
    </div>

    <div :class="layout === 'inline' ? '' : 'mt-1 flex justify-end gap-2'">
      <slot name="actions">
        <OsButton type="submit" variant="primary" :disabled="disabled">{{ submitText }}</OsButton>
      </slot>
    </div>
  </form>
</template>
