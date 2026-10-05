<script setup lang="ts">
import { ref } from 'vue'
import type { Placement } from './types'
import { placementClass } from './internal/placement'

export type { Placement } from './types'

withDefaults(
  defineProps<{
    text: string
    placement?: Placement
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
      :class="[
        'pointer-events-none absolute z-panel whitespace-nowrap rounded-chip bg-ink-strong px-xs py-2xs text-caption text-surface shadow-pop',
        placementClass(placement),
      ]"
    >
      {{ text }}
    </span>
  </span>
</template>
