<script setup lang="ts">
import { computed, ref } from 'vue'
import OsIcon from '@/components/OsIcon.vue'
import type { IconName } from '@/kernel/icons'
import type { Size } from './types'
import { controlHeightClass } from './internal/control'

const props = withDefaults(
  defineProps<{
    src?: string
    alt?: string
    /** 无图时显示文本（首字母等），再缺省回退图标 */
    text?: string
    icon?: IconName
    size?: Size
  }>(),
  { src: '', alt: '', text: '', icon: 'user', size: 'md' },
)

const imgFailed = ref(false)
const showImg = computed(() => props.src !== '' && !imgFailed.value)
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
    :class="[
      controlHeightClass(size),
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
    <OsIcon v-else :name="icon" :size="size === 'sm' ? 12 : 16" />
  </span>
</template>
