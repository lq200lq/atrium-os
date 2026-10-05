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
    /** 计数值；仅 >0 时渲染胶囊（固定 danger 红底），0 或未传整节点不输出 */
    count?: number
    /** 计数上限，超出显示 `max+`；默认 9（即 10 显示 9+） */
    max?: number
    /** 状态点型：只显示圆点（可带插槽文案），不与 count 混用 */
    dot?: boolean
    /** 仅 dot 模式生效：圆点取语义 seed 色；count 胶囊不受影响 */
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
