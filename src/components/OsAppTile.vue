<script setup lang="ts">
import OsIcon from './OsIcon.vue'
import type { IconName } from '@/kernel/icons'

/**
 * 应用磁贴：Dock 与应用中心唯一一处磁贴写法（规范 §3.2）。
 * 图标一律白色——tint 渐变约定 ≥600 档，保证白线图标对渐变端点 ≥4.5:1（见 tile-contrast 门禁）。
 * tint 的缺省值是中性灰磁贴，供运行期网页应用等无品牌色者使用，同样落在 ≥600 档。
 */
const props = withDefaults(defineProps<{ icon: IconName; tint?: string; size?: 'sm' | 'md' }>(), {
  tint: 'from-slate-600 to-slate-700',
  size: 'md',
})

const SIZES = {
  sm: { tile: 'h-12 w-12', icon: 24 }, // Dock
  md: { tile: 'h-14 w-14', icon: 26 }, // 应用中心
} as const
</script>

<template>
  <span
    data-app-tile
    :class="[
      'flex items-center justify-center rounded-dock bg-gradient-to-br text-white shadow',
      SIZES[props.size].tile,
      props.tint,
    ]"
  >
    <OsIcon :name="icon" :size="SIZES[props.size].icon" />
  </span>
</template>
