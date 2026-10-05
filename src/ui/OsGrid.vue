<script setup lang="ts">
import type { GapSize, GridColumns } from './types'
import { GAP_CLASS } from './internal/scale'

export type { GapSize, GridColumns } from './types'

// 列数按「窗口」宽度（cq-window）降档而非视口断点；档位表为静态字面量，
// 保证 Tailwind 能扫描到 w-narrow / w-mid / w-wide 变体类。
const COLUMNS_CLASS: Record<GridColumns, string> = {
  1: 'grid-cols-1 w-mid:grid-cols-1 w-wide:grid-cols-1',
  2: 'grid-cols-1 w-mid:grid-cols-2 w-wide:grid-cols-2',
  3: 'grid-cols-1 w-mid:grid-cols-2 w-wide:grid-cols-3',
  4: 'grid-cols-1 w-mid:grid-cols-2 w-wide:grid-cols-4',
  5: 'grid-cols-1 w-mid:grid-cols-3 w-wide:grid-cols-5',
  6: 'grid-cols-2 w-mid:grid-cols-3 w-wide:grid-cols-6',
}

withDefaults(defineProps<{ columns?: GridColumns; gap?: GapSize }>(), {
  columns: 3,
  gap: 'md',
})
</script>

<template>
  <div class="cq-window">
    <div class="grid" :class="[COLUMNS_CLASS[columns], GAP_CLASS[gap]]">
      <slot />
    </div>
  </div>
</template>
