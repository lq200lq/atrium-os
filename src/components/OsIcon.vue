<script setup lang="ts">
import { computed } from 'vue'
import { ICON_MAP, type IconName } from '@/kernel/icons'

const props = withDefaults(defineProps<{ name: IconName; size?: number; strokeWidth?: number }>(), {
  size: 16,
  strokeWidth: 2,
})

const icon = computed(() => ICON_MAP[props.name] ?? ICON_MAP.file)
</script>

<template>
  <component :is="icon" :size="size" :stroke-width="strokeWidth" aria-hidden="true" />
</template>
