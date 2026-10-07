<script setup lang="ts">
import WindowFrame from './WindowFrame.vue'
import { useShellUi } from '@/kernel/stores/shellUi'
import { useWindowManager } from '@/kernel/stores/windowManager'

const wm = useWindowManager()
const ui = useShellUi()
</script>

<template>
  <!-- 桌面速览（解 E10）：整体透明并让出指针，件层随即显形；再点顶栏按钮或桌面即还原 -->
  <TransitionGroup
    tag="div"
    name="win"
    class="pointer-events-none absolute inset-0 transition duration-base"
    :class="ui.desktopRevealed ? 'opacity-0' : 'opacity-100'"
  >
    <WindowFrame v-for="win in wm.windows" :key="win.id" :win="win" class="pointer-events-auto" />
  </TransitionGroup>
</template>
