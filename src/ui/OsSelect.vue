<script setup lang="ts">
import type { SelectOption, Size, Status } from './types'
import ControlShell from './internal/ControlShell.vue'

export type { SelectOption } from './types'

withDefaults(
  defineProps<{
    options: SelectOption[]
    placeholder?: string
    size?: Size
    disabled?: boolean
    loading?: boolean
    status?: Status
  }>(),
  { placeholder: '请选择', size: 'md', disabled: false, loading: false, status: 'default' },
)

const model = defineModel<string>({ default: '' })
</script>

<template>
  <ControlShell :size="size" :status="status" :disabled="disabled" :loading="loading" filled>
    <select
      v-model="model"
      :disabled="disabled"
      class="h-full w-full min-w-0 flex-1 bg-transparent text-ui text-ink"
    >
      <option v-if="placeholder" value="" disabled>
        {{ placeholder }}
      </option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
  </ControlShell>
</template>
