<script setup lang="ts">
const model = defineModel<string>({ default: '' })
withDefaults(defineProps<{ placeholder?: string }>(), { placeholder: '' })
const emit = defineEmits<{ enter: []; esc: [] }>()
</script>

<template>
  <input
    v-model="model"
    :placeholder="placeholder"
    class="h-control w-full rounded-control border border-line px-sm text-ui text-ink focus:border-accent"
    @keydown.enter="emit('enter')"
    @keydown.esc="emit('esc')"
  />
</template>
