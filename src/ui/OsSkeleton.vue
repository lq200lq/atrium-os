<script setup lang="ts">
withDefaults(
  defineProps<{
    /** text：多行文本骨架；rect：单块矩形；circle：头像圆 */
    variant?: 'text' | 'rect' | 'circle'
    rows?: number
  }>(),
  { variant: 'text', rows: 3 },
)
</script>

<template>
  <div class="animate-pulse" aria-busy="true" aria-live="polite">
    <template v-if="variant === 'text'">
      <div
        v-for="i in rows"
        :key="i"
        class="mb-2 h-3 rounded bg-slate-200/80"
        :class="i === rows ? 'w-2/3' : 'w-full'"
      />
    </template>
    <div v-else-if="variant === 'rect'" class="h-full w-full rounded-lg bg-slate-200/80" />
    <div v-else class="h-10 w-10 rounded-full bg-slate-200/80" />
  </div>
</template>
