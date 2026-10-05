<script setup lang="ts">
withDefaults(defineProps<{ disabled?: boolean; label?: string }>(), {
  disabled: false,
  label: '',
})
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <label class="inline-flex items-center gap-2 text-ui text-ink" :class="disabled && 'is-disabled'">
    <input
      type="checkbox"
      :checked="model"
      :disabled="disabled"
      class="h-4 w-4 rounded-chip border-line accent-[var(--color-accent)]"
      @change="model = ($event.target as HTMLInputElement).checked"
    />
    <span v-if="label">{{ label }}</span>
  </label>
</template>
