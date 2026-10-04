<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'ghost' | 'danger'
    size?: 'sm' | 'md'
    disabled?: boolean
  }>(),
  { variant: 'ghost', size: 'md', disabled: false },
)
</script>

<template>
  <button
    :disabled="disabled"
    :class="[
      'rounded-md transition disabled:opacity-40',
      size === 'sm' ? 'px-2.5 py-1' : 'px-3 py-1.5',
      variant === 'primary' && 'bg-accent text-white hover:brightness-110',
      variant === 'ghost' && 'border border-line text-ink hover:bg-surface-hover',
      variant === 'danger' && 'border border-danger/30 text-danger hover:bg-danger/10',
    ]"
  >
    <slot />
  </button>
</template>
