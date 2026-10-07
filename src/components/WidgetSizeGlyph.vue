<script setup lang="ts">
import { computed } from 'vue'
import { SIZE_SPAN } from '@/kernel/widget/geometry'
import type { WidgetSize } from '@/kernel/stores/widgetRegistry'

/**
 * 网格尺寸字形：4×4 点阵里点亮 `SIZE_SPAN` 的真实跨幅（sm 2×2 / md 4×2 / lg 4×4），
 * 把 D15「整数网格 + 离散档」变成看得见的形状。形状承载语义，不靠颜色。
 * 纯形状无文本节点（不污染 radio 标签与 hasText 过滤）；缺省 aria-hidden，
 * 只有调用方给出 ariaLabel 才作为 img 进读屏。
 */
const props = defineProps<{ size: WidgetSize; ariaLabel?: string }>()

const cells = computed(() => {
  const span = SIZE_SPAN[props.size]
  return Array.from({ length: 16 }, (_, i) => ({
    key: i,
    x: (i % 4) * 4,
    y: Math.floor(i / 4) * 4,
    lit: i % 4 < span.w && Math.floor(i / 4) < span.h,
  }))
})
</script>

<template>
  <svg
    viewBox="0 0 15 15"
    width="15"
    height="15"
    class="shrink-0"
    :role="ariaLabel ? 'img' : undefined"
    :aria-label="ariaLabel || undefined"
    :aria-hidden="ariaLabel ? undefined : 'true'"
  >
    <rect
      v-for="cell in cells"
      :key="cell.key"
      :x="cell.x"
      :y="cell.y"
      width="3"
      height="3"
      rx="1"
      data-size-glyph-cell
      :data-lit="cell.lit ? 'true' : undefined"
      :class="cell.lit ? 'fill-ink' : 'fill-line'"
    />
  </svg>
</template>
