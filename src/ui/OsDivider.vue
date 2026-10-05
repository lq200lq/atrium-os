<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 竖向分隔（self-stretch，高度跟随所在行）；有默认插槽文案时被忽略——带文案恒为横向 */
    vertical?: boolean
    /** 线条改虚线（border-dashed）；带文案时两侧线段同时变虚 */
    dashed?: boolean
  }>(),
  { vertical: false, dashed: false },
)
</script>

<template>
  <div
    v-if="$slots.default"
    role="separator"
    aria-orientation="horizontal"
    class="flex items-center gap-sm"
  >
    <span class="h-px flex-1" :class="dashed ? 'border-t border-dashed border-line' : 'bg-line'" />
    <span class="shrink-0 text-caption text-ink-mute"><slot /></span>
    <span class="h-px flex-1" :class="dashed ? 'border-t border-dashed border-line' : 'bg-line'" />
  </div>
  <div
    v-else
    role="separator"
    :aria-orientation="vertical ? 'vertical' : 'horizontal'"
    :class="[
      vertical ? 'w-px self-stretch' : 'h-px w-full',
      dashed ? `border-dashed border-line ${vertical ? 'border-l' : 'border-t'}` : 'bg-line',
    ]"
  />
</template>
