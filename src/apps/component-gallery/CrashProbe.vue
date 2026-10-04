<script setup lang="ts">
const props = defineProps<{ when: boolean }>()

// 渲染期主动抛错，用于演示窗口级错误边界（ErrorBoundary）：应用崩溃不拖垮壳层
function probe(): string {
  if (props.when) throw new Error('CrashProbe: 组件陈列主动抛错演示')
  return ''
}
</script>

<template>
  <span>{{ probe() }}</span>
</template>
