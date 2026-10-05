<script setup lang="ts">
import OsIcon from '@/components/OsIcon.vue'
import { useControlSize } from './config'
import type { Size } from './types'
import { controlHeightClass } from './internal/control'

/**
 * 中性 loading 契约复用件（S10，规划 §S8 三态契约点名句）：
 * 任何数据类组件的加载态都渲染此件，不再自写。两型——
 * 内联（无默认插槽）与容器遮罩（默认插槽包内容，loading 时盖半透明遮罩 + 居中指示器）。
 */

// 直径容器走控件高刻度（h-control-* + aspect-square）；lucide 图标需要显式宽高，
// 数值按三档控件高等比缩放（与 OsButton/OsTag 的内联图标同一惯例）
const ICON_PX: Record<Size, number> = { sm: 12, md: 14, lg: 16 }

const props = withDefaults(
  defineProps<{
    /** 缺省 true：内联型挂载即转（可纯当指示器用）；容器型以此控制遮罩显隐 */
    loading?: boolean
    /** 直径走 h-control-* 刻度；缺省可被 OsConfigProvider 的 size 覆盖 */
    size?: Size
    tip?: string
  }>(),
  { loading: true, size: undefined, tip: '' },
)

const resolvedSize = useControlSize(() => props.size)
</script>

<template>
  <div v-if="$slots.default" class="relative" :aria-busy="loading ? 'true' : undefined">
    <slot />
    <div
      v-if="loading"
      role="status"
      aria-live="polite"
      class="absolute inset-0 z-sticky flex flex-col items-center justify-center gap-xs bg-surface/60"
    >
      <span
        class="inline-flex aspect-square items-center justify-center text-accent"
        :class="controlHeightClass(resolvedSize)"
      >
        <OsIcon name="loader-circle" :size="ICON_PX[resolvedSize]" class="animate-spin" />
      </span>
      <span v-if="tip" class="text-caption text-ink-mute">{{ tip }}</span>
    </div>
  </div>

  <div
    v-else-if="loading"
    role="status"
    aria-live="polite"
    aria-busy="true"
    class="inline-flex flex-col items-center gap-2xs"
  >
    <span
      class="inline-flex aspect-square items-center justify-center text-accent"
      :class="controlHeightClass(resolvedSize)"
    >
      <OsIcon name="loader-circle" :size="ICON_PX[resolvedSize]" class="animate-spin" />
    </span>
    <span v-if="tip" class="text-caption text-ink-mute">{{ tip }}</span>
  </div>
</template>
