<script setup lang="ts">
import OsIcon from '@/components/OsIcon.vue'
import type { Size, Status } from '../types'
import { controlHeightClass, controlPaddingClass, controlStatusClass } from './control'

// Input 与 Select 共用的控件外框：尺寸/状态/禁用/loading 指示只在此处派生一次
withDefaults(
  defineProps<{
    size?: Size
    status?: Status
    disabled?: boolean
    loading?: boolean
    /** 填充分支：Select 需要实心面（原生控件外观），Input 保持透明以叠在玻璃上 */
    filled?: boolean
  }>(),
  { size: 'md', status: 'default', disabled: false, loading: false, filled: false },
)
</script>

<template>
  <div
    class="flex w-full items-center gap-2xs rounded-control border transition"
    :class="[
      controlHeightClass(size),
      controlPaddingClass(size),
      controlStatusClass(status),
      filled && 'bg-surface',
      disabled && 'is-disabled',
    ]"
  >
    <slot />
    <div v-if="loading || $slots.suffix" class="ml-auto flex shrink-0 items-center gap-2xs">
      <slot name="suffix" />
      <OsIcon v-if="loading" name="loader-circle" :size="14" class="animate-spin text-ink-mute" />
    </div>
  </div>
</template>
