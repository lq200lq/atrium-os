<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useOS } from '@/kernel/composables/useOS'
import { useTheme } from '@/kernel/stores/theme'
import { useWindowManager } from '@/kernel/stores/windowManager'

const props = defineProps<{ x: number; y: number }>()
const emit = defineEmits<{ close: [] }>()

const wm = useWindowManager()
const theme = useTheme()
const os = useOS()
const root = ref<HTMLElement | null>(null)

const pos = computed(() => ({
  left: `${Math.min(props.x, window.innerWidth - 184)}px`,
  top: `${Math.min(props.y, window.innerHeight - 132)}px`,
}))

const items = [
  { label: '层叠窗口', run: () => wm.cascadeAll() },
  { label: '更换壁纸', run: () => theme.cycleWallpaper() },
  { label: '打开应用中心', run: () => os.exec('app-center:open') },
]

function runItem(it: { run: () => void }) {
  it.run()
  emit('close')
}

function onOutside(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) emit('close')
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => {
  window.addEventListener('pointerdown', onOutside, true)
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  window.removeEventListener('pointerdown', onOutside, true)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <ul
    ref="root"
    class="fixed z-[9000] w-44 rounded-lg border border-white/50 bg-white/90 py-1 text-[13px] text-slate-700 shadow-xl backdrop-blur-xl"
    :style="pos"
  >
    <li v-for="it in items" :key="it.label">
      <button
        class="w-full px-4 py-1.5 text-left hover:bg-sky-50 hover:text-sky-700"
        @click="runItem(it)"
      >
        {{ it.label }}
      </button>
    </li>
  </ul>
</template>
