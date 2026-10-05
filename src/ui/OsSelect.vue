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
    class="h-control w-full rounded-control border border-line bg-surface px-sm text-ui text-ink focus:border-accent disabled:is-disabled"
  >
    <option v-if="placeholder" value="" disabled>
      {{ placeholder }}
    </option>
    <option v-for="opt in options" :key="opt.value" :value="opt.value">
      {{ opt.label }}
    </option>
  </select>
</template>
