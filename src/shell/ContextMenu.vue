<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOS } from '@/kernel/composables/useOS'
import { useTheme } from '@/kernel/stores/theme'
import { useWindowManager } from '@/kernel/stores/windowManager'

const props = defineProps<{ x: number; y: number }>()
const emit = defineEmits<{ close: [] }>()

const wm = useWindowManager()
const theme = useTheme()
const os = useOS()
const { t } = useI18n()
const root = ref<HTMLElement | null>(null)

const pos = computed(() => ({
  left: `${Math.min(props.x, window.innerWidth - 184)}px`,
  top: `${Math.min(props.y, window.innerHeight - 132)}px`,
}))

const items = [
  { key: 'context.cascade', run: () => wm.cascadeAll() },
  { key: 'context.wallpaper', run: () => theme.cycleWallpaper() },
  { key: 'context.appCenter', run: () => os.exec('app-center:open') },
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
    class="fixed z-panel w-44 rounded-surface border border-glass-border-active bg-glass-pop py-1 text-ui text-ink shadow-pop backdrop-blur-xl"
    :style="pos"
  >
    <li v-for="it in items" :key="it.key">
      <button
        class="w-full px-4 py-xs text-left hover:bg-accent-soft hover:text-accent-strong"
        @click="runItem(it)"
      >
        {{ t(it.key) }}
      </button>
    </li>
  </ul>
</template>
