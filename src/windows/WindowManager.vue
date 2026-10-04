<script setup lang="ts">
import { useWindowManager } from '@/kernel/stores/windowManager'
import WindowFrame from './WindowFrame.vue'

const wm = useWindowManager()
</script>

<template>
  <TransitionGroup tag="div" name="win" class="pointer-events-none absolute inset-0">
    <WindowFrame v-for="win in wm.windows" :key="win.id" :win="win" class="pointer-events-auto" />
  </TransitionGroup>
</template>
