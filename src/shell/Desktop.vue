<script setup lang="ts">
import { ref } from 'vue'
import ContextMenu from '@/shell/ContextMenu.vue'
import { useTheme } from '@/kernel/stores/theme'
import { useWindowManager } from '@/kernel/stores/windowManager'

const wm = useWindowManager()
const theme = useTheme()

const menu = ref<{ x: number; y: number } | null>(null)

function onDesktopDown() {
  wm.blur()
  menu.value = null
}

function onContext(e: MouseEvent) {
  menu.value = { x: e.clientX, y: e.clientY }
}
</script>

<template>
  <div
    class="absolute inset-0"
    :class="theme.wallpaper"
    @pointerdown.self="onDesktopDown"
    @contextmenu.prevent="onContext"
  >
    <div class="wallpaper-slogan absolute left-12 top-[36%] text-white drop-shadow-lg">
      <p class="text-5xl italic tracking-wide">万物皆应用</p>
      <p class="mt-3 text-2xl italic tracking-widest">让一切能力成为应用</p>
    </div>
    <ContextMenu v-if="menu" :x="menu.x" :y="menu.y" @close="menu = null" />
  </div>
</template>
