<script setup lang="ts">
import OsIcon from '@/components/OsIcon.vue'
import { useControlSize } from '../config'
import type { Size, Status } from '../types'
import { controlHeightClass, controlPaddingClass, controlStatusClass } from './control'

// Input 与 Select 共用的控件外框：尺寸/状态/禁用/loading 指示只在此处派生一次
const props = withDefaults(
  defineProps<{
    size?: Size
    status?: Status
    disabled?: boolean
    loading?: boolean
    /** 填充分支：Select 需要实心面（原生控件外观），Input 保持透明以叠在玻璃上 */
    filled?: boolean
  }>(),
  { size: undefined, status: 'default', disabled: false, loading: false, filled: false },
)

// 尺寸在框体一处决议：显式 prop > OsConfigProvider 缺省 > md，input 家族因此免费拿到作用域缺省
const resolvedSize = useControlSize(() => props.size)
</script>

<template>
  <div
    class="flex w-full items-center gap-2xs rounded-control border transition"
    :class="[
      controlHeightClass(resolvedSize),
      controlPaddingClass(resolvedSize),
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
