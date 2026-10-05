<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import { useAppRegistry } from '@/kernel/stores/appRegistry'
import { useWindowManager } from '@/kernel/stores/windowManager'
import { useAppName } from '@/i18n'

const registry = useAppRegistry()
const wm = useWindowManager()
const { t } = useI18n()
const appName = useAppName()
const q = ref('')

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
    <div class="border-b border-line p-3">
      <input
        v-model="q"
        class="h-control w-full rounded-full border border-line bg-surface-sunken px-md focus:border-accent focus:bg-surface"
        :placeholder="t('appCenter.search')"
      />
    </div>
    <div class="grid flex-1 grid-cols-4 content-start gap-3 overflow-y-auto p-4">
      <button
        v-for="app in apps"
        :key="app.id"
        class="flex flex-col items-center gap-2xs rounded-surface p-3 hover:bg-accent-soft"
        @click="wm.open(app.id)"
      >
        <span
          :class="[
            'flex h-14 w-14 items-center justify-center rounded-dock bg-gradient-to-br text-display-3 shadow',
            app.tint ?? 'from-slate-400 to-slate-500',
          ]"
        >
          <OsIcon :name="app.icon" :size="26" class="text-on-accent" />
        </span>
        <span class="text-ink">{{ appName(app) }}</span>
        <span class="text-caption text-ink-mute">{{
          app.singleton ? t('appCenter.singleton') : t('appCenter.multi')
        }}</span>
      </button>
      <p v-if="apps.length === 0" class="col-span-4 py-10 text-center text-ink-mute">
        {{ t('appCenter.noMatch') }}
      </p>
    </div>
  </div>
</template>
