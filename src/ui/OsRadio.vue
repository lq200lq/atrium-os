<script setup lang="ts">
export interface RadioOption {
  value: string
  label: string
}

withDefaults(
  defineProps<{
    options: RadioOption[]
    name?: string
    disabled?: boolean
  }>(),
  { name: 'os-radio', disabled: false },
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
        @change="model = opt.value"
      />
      <span>{{ opt.label }}</span>
    </label>
  </div>
</template>
