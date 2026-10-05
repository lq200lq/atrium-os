<script setup lang="ts">
import type { BadgeStatus } from './types'

export type { BadgeStatus } from './types'

// 状态点配色取语义色 seed：徽标是「只读状态」，与描边/浅底分支（-border/-bg）不同层
const DOT_CLASS: Record<BadgeStatus, string> = {
  default: 'bg-ink-mute',
  error: 'bg-danger',
  warning: 'bg-warning',
  success: 'bg-success',
  info: 'bg-info',
}

withDefaults(
  defineProps<{
    count?: number
    max?: number
    /** 状态点型：只显示圆点（可带插槽文案），不与 count 混用 */
    dot?: boolean
    status?: BadgeStatus
  }>(),
  { count: 0, max: 9, dot: false, status: 'default' },
)
</script>

<template>
  <span v-if="dot" class="inline-flex items-center gap-2xs text-ui text-ink">
    <span class="h-2 w-2 shrink-0 rounded-full" :class="DOT_CLASS[status]" />
    <slot />
  </span>
  <span
    v-else-if="count > 0"
    class="flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-2xs text-micro font-strong text-white"
  >
    {{ count > max ? `${max}+` : count }}
  </span>
</template>
