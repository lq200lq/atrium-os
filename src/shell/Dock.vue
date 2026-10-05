<script setup lang="ts">
import OsIcon from '@/components/OsIcon.vue'
import { useAppRegistry, type RegisteredApp } from '@/kernel/stores/appRegistry'
import { useWindowManager } from '@/kernel/stores/windowManager'
import { useAppName } from '@/i18n'

const registry = useAppRegistry()
const wm = useWindowManager()
const appName = useAppName()

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
    <button
      v-for="app in registry.dockApps"
      :key="app.id"
      class="group relative flex flex-col items-center gap-1"
      :title="appName(app)"
      @click="onDockClick(app)"
    >
      <span
        :class="[
          'flex h-12 w-12 items-center justify-center rounded-dock bg-gradient-to-br text-display-3 shadow-md transition-transform group-hover:-translate-y-1 group-hover:scale-105',
          app.tint ?? 'from-slate-400 to-slate-500',
        ]"
      >
        <OsIcon :name="app.icon" :size="24" class="text-white" />
      </span>
      <span
        v-if="wm.isRunning(app.id)"
        class="absolute -bottom-1 h-1 w-1 rounded-full bg-ink-mute"
      />
    </button>
  </nav>
</template>
