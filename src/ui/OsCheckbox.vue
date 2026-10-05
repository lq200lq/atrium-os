<script setup lang="ts">
import type { Status } from './types'
import { controlStatusClass } from './internal/control'

withDefaults(defineProps<{ disabled?: boolean; label?: string; status?: Status }>(), {
  disabled: false,
  label: '',
  status: 'default',
})
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <label class="inline-flex items-center gap-2 text-ui text-ink" :class="disabled && 'is-disabled'">
    <input
      type="checkbox"
      :checked="model"
      :disabled="disabled"
      class="h-4 w-4 rounded-chip accent-[var(--color-accent)]"
      :class="controlStatusClass(status)"
      @change="model = ($event.target as HTMLInputElement).checked"
    />
    <span v-if="label">{{ label }}</span>
  </label>
</template>
