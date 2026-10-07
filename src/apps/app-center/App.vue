<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import OsAppTile from '@/components/OsAppTile.vue'
import OsSegmented from '@/ui/OsSegmented.vue'
import WebAppsPanel from './WebAppsPanel.vue'
import { useAppRegistry } from '@/kernel/stores/appRegistry'
import { useWindowManager } from '@/kernel/stores/windowManager'
import { useAppName } from '@/i18n'

const registry = useAppRegistry()
const wm = useWindowManager()
const { t } = useI18n()
const appName = useAppName()
const q = ref('')
const tab = ref('all')

const tabs = computed(() => [
  { value: 'all', label: t('appCenter.tabAll'), icon: 'boxes' as const },
  { value: 'web', label: t('appCenter.tabWeb'), icon: 'globe' as const },
])

const apps = computed(() => {
  const kw = q.value.trim().toLowerCase()
  if (!kw) return registry.accessibleApps
  return registry.accessibleApps.filter(
    (a) =>
      appName(a).toLowerCase().includes(kw) ||
      a.name.toLowerCase().includes(kw) ||
      a.id.includes(kw) ||
      a.keywords?.some((k) => k.toLowerCase().includes(kw)),
  )
})
</script>

<template>
  <div class="flex h-full flex-col text-ui">
    <div class="flex items-center gap-2 border-b border-line p-3">
      <input
        v-model="q"
        class="h-control min-w-0 flex-1 rounded-full border border-line bg-surface-sunken px-md focus:border-accent focus:bg-surface"
        :placeholder="t('appCenter.search')"
      />
      <OsSegmented v-model="tab" :options="tabs" :label="t('appCenter.tabsAria')" />
    </div>
    <WebAppsPanel v-if="tab === 'web'" :query="q" class="min-h-0 flex-1" />
    <div v-else class="grid flex-1 grid-cols-4 content-start gap-3 overflow-y-auto p-4">
      <button
        v-for="app in apps"
        :key="app.id"
        class="flex flex-col items-center gap-2xs rounded-surface p-3 hover:bg-accent-soft"
        @click="wm.open(app.id)"
      >
        <OsAppTile :icon="app.icon" :tint="app.tint" size="md" />
        <span class="text-ink">{{ appName(app) }}</span>
      </button>
      <p v-if="apps.length === 0" class="col-span-4 py-10 text-center text-ink-mute">
        {{ t('appCenter.noMatch') }}
      </p>
    </div>
  </div>
</template>
