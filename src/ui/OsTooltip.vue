<script setup lang="ts">
import { ref } from 'vue'

type Placement = 'top' | 'bottom' | 'left' | 'right'

// 四向纯 CSS 定位：气泡只贴触发元素的一边，不做溢出翻转（浮层定位原语属 S10）
const PLACEMENT_CLASS: Record<Placement, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2xs',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2xs',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2xs',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2xs',
}

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
      class="pointer-events-none absolute z-50 whitespace-nowrap rounded-chip bg-ink-strong px-xs py-2xs text-caption text-surface shadow-pop"
      :class="PLACEMENT_CLASS[placement]"
    >
      {{ text }}
    </span>
  </span>
</template>
