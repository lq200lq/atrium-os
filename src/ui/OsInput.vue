<script setup lang="ts">
const model = defineModel<string>({ default: '' })
withDefaults(defineProps<{ placeholder?: string }>(), { placeholder: '' })
const emit = defineEmits<{ enter: []; esc: [] }>()
</script>

<template>
  <input
    v-model="model"
    :placeholder="placeholder"
    class="w-full rounded-md border border-slate-200 px-3 py-1.5 text-ui text-ink outline-none focus:border-accent"
    @keydown.enter="emit('enter')"
    @keydown.esc="emit('esc')"
  />
</template>
