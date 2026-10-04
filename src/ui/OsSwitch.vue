<script setup lang="ts">
withDefaults(defineProps<{ disabled?: boolean; label?: string }>(), {
  disabled: false,
  label: '',
})
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <label
    class="inline-flex cursor-pointer items-center gap-2 text-ui text-ink"
    :class="{ 'cursor-not-allowed opacity-40': disabled }"
  >
    <button
      type="button"
      role="switch"
      :aria-checked="model"
      :disabled="disabled"
      class="relative h-5 w-9 rounded-full transition"
      :class="model ? 'bg-accent' : 'bg-slate-300'"
      @click="!disabled && (model = !model)"
    >
      <span
        class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
        :class="model ? 'left-4.5' : 'left-0.5'"
      />
    </button>
    <span v-if="label">{{ label }}</span>
  </label>
</template>
