<script setup lang="ts">
export interface SelectOption {
  value: string
  label: string
}

withDefaults(
  defineProps<{
    options: SelectOption[]
    placeholder?: string
    disabled?: boolean
  }>(),
  { placeholder: '请选择', disabled: false },
)

const model = defineModel<string>({ default: '' })
</script>

<template>
  <select
    v-model="model"
    :disabled="disabled"
    class="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-ui text-ink outline-none focus:border-accent disabled:opacity-40"
  >
    <option v-if="placeholder" value="" disabled>
      {{ placeholder }}
    </option>
    <option v-for="opt in options" :key="opt.value" :value="opt.value">
      {{ opt.label }}
    </option>
  </select>
</template>
