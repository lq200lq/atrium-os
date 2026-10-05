<script setup lang="ts">
import type { GapSize, SpaceAlign, SpaceDirection } from './types'
import { ALIGN_CLASS, GAP_CLASS } from './internal/scale'

export type { GapSize, SpaceAlign, SpaceDirection } from './types'

withDefaults(
  defineProps<{
    direction?: SpaceDirection
    size?: GapSize
    align?: SpaceAlign
    wrap?: boolean
  }>(),
  { direction: 'row', size: 'sm', align: 'start', wrap: false },
)
</script>

<template>
  <div
    class="flex"
    :class="[
      direction === 'column' ? 'flex-col' : 'flex-row',
      GAP_CLASS[size],
      ALIGN_CLASS[align],
      wrap && 'flex-wrap',
    ]"
  >
    <slot />
  </div>
</template>
