<script setup lang="ts">
import { computed } from 'vue'
import OsAppTile from '@/components/OsAppTile.vue'
import { useAppRegistry, type RegisteredApp } from '@/kernel/stores/appRegistry'
import { useWindowManager } from '@/kernel/stores/windowManager'
import { useAppName } from '@/i18n'

const registry = useAppRegistry()
const wm = useWindowManager()
const appName = useAppName()

/** 两组：锚定组（最左，如应用中心）在前，常规组在后；空组不渲染分割线 */
const dockGroups = computed(() =>
  [registry.dockAnchors, registry.dockRest].filter((group) => group.length),
)

function onDockClick(app: RegisteredApp) {
  const wins = wm.windows.filter((w) => w.appId === app.id)
  const active = wins.find((w) => w.id === wm.activeId && w.status === 'normal')
  if (active) {
    wm.minimize(active.id)
    return
  }
  const minimized = [...wins].reverse().find((w) => w.status === 'minimized')
  if (minimized) {
    wm.restore(minimized.id)
    return
  }
  wm.open(app.id)
}
</script>

<template>
  <nav
    class="fixed bottom-3 left-1/2 z-shell flex -translate-x-1/2 items-end gap-2 rounded-dock border border-glass-border bg-glass-bar px-3 py-2 shadow-dock backdrop-blur-xl"
  >
    <template v-for="(group, gi) in dockGroups" :key="gi">
      <span
        v-if="gi > 0"
        data-dock-divider
        aria-hidden="true"
        class="mx-2xs h-12 w-px shrink-0 bg-ink"
      />
      <button
        v-for="app in group"
        :key="app.id"
        class="group relative flex flex-col items-center gap-1"
        :title="appName(app)"
        @click="onDockClick(app)"
      >
        <OsAppTile
          :icon="app.icon"
          :tint="app.tint"
          size="sm"
          class="transition-transform group-hover:-translate-y-1 group-hover:scale-105"
        />
        <span
          v-if="wm.isRunning(app.id)"
          class="absolute -bottom-1 h-1 w-1 rounded-full bg-ink-mute"
        />
      </button>
    </template>
  </nav>
</template>
