<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import OsSwitch from '@/ui/OsSwitch.vue'
import OsSelect from '@/ui/OsSelect.vue'
import OsInputNumber from '@/ui/OsInputNumber.vue'
import OsInput from '@/ui/OsInput.vue'
import { normalizeOptions, type WidgetConfigField } from '@/kernel/stores/widgetRegistry'
import type { WidgetConfigValues } from '@/kernel/stores/widgets'
import { fieldLabel, optionLabel } from '@/kernel/widget/configText'

/**
 * schema 的缺省渲染器（§4.12 第一层）：控件由宿主画，件只提供数据。
 * 它不认识 store——值与写回都走 props/emit，因此宿主容器可以把整块表达换成件自绘的
 * `configEntry`，也可以单独拿它渲染只读表单，两条路共用同一份写边界。
 */
const props = withDefaults(
  defineProps<{
    fields: WidgetConfigField[]
    modelValue: WidgetConfigValues
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [WidgetConfigValues] }>()

const { t, te } = useI18n()

function set(key: string, value: string | number | boolean) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

function placeholderOf(field: WidgetConfigField): string {
  if (field.placeholderKey && te(field.placeholderKey)) return t(field.placeholderKey)
  return field.placeholder ?? ''
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div
      v-for="field in props.fields"
      :key="field.key"
      class="flex items-center justify-between gap-3"
      :class="field.type === 'text' ? 'flex-col items-stretch' : ''"
    >
      <span class="text-ui text-ink">{{ fieldLabel(field, t, te) }}</span>

      <OsSwitch
        v-if="field.type === 'boolean'"
        :model-value="props.modelValue[field.key] === true"
        :aria-label="fieldLabel(field, t, te)"
        :disabled="props.disabled"
        @update:model-value="set(field.key, $event)"
      />
      <OsSelect
        v-else-if="field.type === 'select'"
        class="w-40 shrink-0"
        :model-value="String(props.modelValue[field.key] ?? '')"
        :options="
          normalizeOptions(field).map((o) => ({ value: o.value, label: optionLabel(o, t, te) }))
        "
        :aria-label="fieldLabel(field, t, te)"
        :disabled="props.disabled"
        @update:model-value="set(field.key, $event)"
      />
      <OsInputNumber
        v-else-if="field.type === 'number'"
        class="w-28 shrink-0"
        :model-value="Number(props.modelValue[field.key] ?? 0)"
        :min="field.min"
        :max="field.max"
        :step="field.step ?? 1"
        :aria-label="fieldLabel(field, t, te)"
        :disabled="props.disabled"
        @update:model-value="set(field.key, Number($event ?? 0))"
      />
      <OsInput
        v-else
        :model-value="String(props.modelValue[field.key] ?? '')"
        :placeholder="placeholderOf(field)"
        :aria-label="fieldLabel(field, t, te)"
        :disabled="props.disabled"
        @update:model-value="set(field.key, $event)"
      />
    </div>
  </div>
</template>
