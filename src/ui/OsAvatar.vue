<script setup lang="ts">
import { computed, ref } from 'vue'
import OsIcon from '@/components/OsIcon.vue'
import { useControlSize } from './config'
import type { IconName } from '@/kernel/icons'
import type { Size } from './types'
import { controlHeightClass } from './internal/control'

const props = withDefaults(
  defineProps<{
    /** 图片地址；加载 error 后自动回退到 text/icon 分支（imgFailed 置位） */
    src?: string
    /** img 的 alt 文本；仅在图片分支生效，text/icon 回退时不使用 */
    alt?: string
    /** 无图时显示文本（首字母等），再缺省回退图标 */
    text?: string
    /** src 与 text 都不可用时的兜底图标；sm 档 12px、其余 16px */
    icon?: IconName
    /** 直径复用控件高度刻度（24/28/32），aspect-square 保持圆形；缺省可被 OsConfigProvider 的 size 覆盖 */
    size?: Size
  }>(),
  { src: '', alt: '', text: '', icon: 'user', size: undefined },
)

const resolvedSize = useControlSize(() => props.size)

const imgFailed = ref(false)
const showImg = computed(() => props.src !== '' && !imgFailed.value)
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
    :class="[
      controlHeightClass(resolvedSize),
      'aspect-square',
      showImg ? '' : text ? 'bg-accent-bg text-accent-text' : 'bg-fill text-ink-mute',
    ]"
  >
    <img
      v-if="showImg"
      :src="src"
      :alt="alt"
      class="h-full w-full object-cover"
      @error="imgFailed = true"
    />
    <span v-else-if="text" class="truncate px-2xs text-caption font-strong">{{ text }}</span>
    <OsIcon v-else :name="icon" :size="resolvedSize === 'sm' ? 12 : 16" />
  </span>
</template>
