<script setup lang="ts">
import OsIcon from '@/components/OsIcon.vue'
import { useControlSize } from './config'
import type { Size } from './types'
import { controlHeightClass, controlPaddingClass } from './internal/control'

const props = withDefaults(
  defineProps<{
    /** primary 实底 / ghost 描边（默认） / danger 红字描边；无 text 档 */
    variant?: 'primary' | 'ghost' | 'danger'
    /** 高度与内边距同档联动（h-control-* + px-*）；缺省可被 OsConfigProvider 的 size 覆盖 */
    size?: Size
    /** 落原生 disabled，鼠标态走 is-disabled 唯一写法 */
    disabled?: boolean
    /** 前置等宽 spinner（防文案跳动），自动禁用点击并置 aria-busy */
    loading?: boolean
    /** 品牌渐变实底（小组件库「添加」用）：给了它就取代 primary 的强调色底，白字对 ≥600 档渐变沿用磁贴那套对比度约定 */
    tint?: string
  }>(),
  { variant: 'ghost', size: undefined, disabled: false, loading: false, tint: undefined },
)

const resolvedSize = useControlSize(() => props.size)
</script>

<template>
  <button
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    :class="[
      'inline-flex items-center justify-center rounded-control transition disabled:is-disabled',
      controlHeightClass(resolvedSize),
      controlPaddingClass(resolvedSize),
      tint && `bg-gradient-to-br ${tint} text-white shadow hover:brightness-110`,
      !tint && variant === 'primary' && 'bg-accent-fill text-white hover:brightness-110',
      !tint && variant === 'ghost' && 'border border-line text-ink hover:bg-surface-hover',
      !tint && variant === 'danger' && 'border border-danger/30 text-danger hover:bg-danger/10',
    ]"
  >
    <!-- loading 用等宽占位，避免文案在切换时横向跳动 -->
    <span v-if="loading" class="mr-2xs inline-flex w-4 shrink-0 justify-center">
      <OsIcon name="loader-circle" :size="14" class="animate-spin" />
    </span>
    <slot />
  </button>
</template>
