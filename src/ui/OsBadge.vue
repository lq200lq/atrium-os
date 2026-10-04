<script setup lang="ts">
withDefaults(defineProps<{ count: number; max?: number }>(), { max: 9 })
</script>

<template>
  <span
    v-if="count > 0"
    class="flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-micro font-medium text-white"
  >
    {{ count > max ? `${max}+` : count }}
  </span>
</template>
