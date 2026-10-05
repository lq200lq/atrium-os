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
      'inline-flex items-center justify-center rounded-control transition disabled:is-disabled',
      size === 'sm' ? 'h-control-sm px-xs' : 'h-control px-sm',
      variant === 'primary' && 'bg-accent text-white hover:brightness-110',
      variant === 'ghost' && 'border border-line text-ink hover:bg-surface-hover',
      variant === 'danger' && 'border border-danger/30 text-danger hover:bg-danger/10',
    ]"
  >
    <slot />
  </button>
</template>
