<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import OsIcon from '@/components/OsIcon.vue'
import { useShellUi, type ContextMenuItem } from '@/kernel/stores/shellUi'

/**
 * 壳层右键菜单宿主（单例）：桌面空白处与小组件卡片共用这一处呈现，
 * 条目由调用方经 `shellUi.openContextMenu()` 传入。
 *
 * 位置按实测尺寸夹取而不是写死宽高——条目数由调用方决定（卡片菜单会随尺寸档数量变），
 * 写死的下限会在条目多时把菜单顶出视口。
 */
const ui = useShellUi()
const menu = computed(() => ui.contextMenu)
const root = ref<HTMLElement | null>(null)
const box = ref({ w: 176, h: 132 })

watch(menu, async (next) => {
  if (!next) return
  await nextTick()
  const el = root.value
  if (el) box.value = { w: el.offsetWidth, h: el.offsetHeight }
})

const pos = computed(() => {
  const m = menu.value
  if (!m) return {}
  return {
    left: `${Math.min(m.x, window.innerWidth - box.value.w - 8)}px`,
    top: `${Math.min(m.y, window.innerHeight - box.value.h - 8)}px`,
  }
})

function toneClass(it: ContextMenuItem): string {
  return it.danger
    ? 'text-danger-text hover:bg-danger-bg'
    : 'hover:bg-accent-soft hover:text-accent-strong'
}

/** 先收起再执行：条目动作常开浮层（抽屉/窗口/确认框），菜单不该压在上面 */
function run(it: ContextMenuItem) {
  ui.closeContextMenu()
  it.run()
}

function onOutside(e: PointerEvent) {
  if (menu.value && !root.value?.contains(e.target as Node)) ui.closeContextMenu()
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') ui.closeContextMenu()
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
    v-if="menu"
    ref="root"
    data-shell-menu
    class="fixed z-panel w-44 rounded-surface border border-glass-border-active bg-glass-pop py-1 text-ui text-ink shadow-pop backdrop-blur-xl"
    :style="pos"
  >
    <template v-for="it in menu.items" :key="it.key">
      <li v-if="it.separatorBefore" aria-hidden="true" class="my-1 h-px bg-glass-border" />
      <li>
        <button
          type="button"
          class="flex w-full items-center gap-2xs px-4 py-xs text-left"
          :class="toneClass(it)"
          @click="run(it)"
        >
          <OsIcon v-if="it.checked" name="check" :size="12" />
          <span class="min-w-0 flex-1 truncate">{{ it.label }}</span>
        </button>
      </li>
    </template>
  </ul>
</template>
