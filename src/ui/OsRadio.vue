<script setup lang="ts">
import type { RadioOption, Status } from './types'
import { controlStatusClass } from './internal/control'

export type { RadioOption } from './types'

withDefaults(
  defineProps<{
    options: RadioOption[]
    name?: string
    disabled?: boolean
    status?: Status
  }>(),
  { name: 'os-radio', disabled: false, status: 'default' },
)

const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="flex flex-wrap items-center gap-3 text-ui text-ink" role="radiogroup">
    <label
      v-for="opt in options"
      :key="opt.value"
      class="inline-flex items-center gap-xs"
      :class="disabled && 'is-disabled'"
    >
      <input
        type="radio"
        :name="name"
        :value="opt.value"
        :checked="model === opt.value"
        :disabled="disabled"
        class="h-4 w-4 accent-[var(--color-accent)]"
        :class="controlStatusClass(status)"
        @change="model = opt.value"
      />
      <span>{{ opt.label }}</span>
    </label>
  </div>
</template>
