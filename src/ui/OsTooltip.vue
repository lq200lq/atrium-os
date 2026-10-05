<script setup lang="ts">
import { ref } from 'vue'

withDefaults(
  defineProps<{
    text: string
    placement?: 'top' | 'bottom'
  }>(),
  { placement: 'top' },
)

const show = ref(false)
</script>

<template>
  <span
    class="relative inline-flex"
    @mouseenter="show = true"
    @mouseleave="show = false"
    @focusin="show = true"
    @focusout="show = false"
  >
    <slot />
    <span
      v-if="show"
      role="tooltip"
      class="pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-chip bg-ink-strong px-xs py-2xs text-caption text-surface shadow-pop"
      :class="placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'"
    >
      {{ text }}
    </span>
  </span>
</template>
