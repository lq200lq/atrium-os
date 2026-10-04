<script setup lang="ts">
import OsButton from './OsButton.vue'

withDefaults(defineProps<{ title: string; confirmText?: string; cancelText?: string }>(), {
  confirmText: '确定',
  cancelText: '取消',
})
const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <div
    class="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/25"
    @pointerdown.self="emit('cancel')"
  >
    <div class="w-72 rounded-xl bg-white p-4 shadow-pop">
      <p class="mb-3 font-medium text-ink">{{ title }}</p>
      <slot />
      <div class="mt-4 flex justify-end gap-2">
        <OsButton size="sm" @click="emit('cancel')">{{ cancelText }}</OsButton>
        <OsButton size="sm" variant="primary" @click="emit('confirm')">{{ confirmText }}</OsButton>
      </div>
    </div>
  </div>
</template>
