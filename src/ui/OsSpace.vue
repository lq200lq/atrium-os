<script setup lang="ts">
import type { GapSize, SpaceAlign, SpaceDirection } from './types'
import { ALIGN_CLASS, GAP_CLASS } from './internal/scale'

export type { GapSize, SpaceAlign, SpaceDirection } from './types'

withDefaults(
  defineProps<{
    /** flex 主轴方向，column 时子项纵向堆叠 */
    direction?: SpaceDirection
    /** 相邻子项间隙，与 OsGrid gap 同用 GapSize 七档刻度 */
    size?: GapSize
    /** 交叉轴对齐（items 语义），不影响主轴排布 */
    align?: SpaceAlign
    /** 允许换行（flex-wrap） */
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
