<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import OsRadio from '@/ui/OsRadio.vue'
import { useAppRegistry } from '@/kernel/stores/appRegistry'
import { useSession, USERS } from '@/kernel/stores/session'
import { useSettings } from '@/kernel/stores/settings'
import {
  useTheme,
  WALLPAPER_KEYS,
  MODES,
  ACCENT_KEYS,
  type ThemeMode,
  type AccentKey,
} from '@/kernel/stores/theme'
import { useWindowManager } from '@/kernel/stores/windowManager'
import { LOCALES, useAppName, type Locale } from '@/i18n'
import OsButton from '@/ui/OsButton.vue'

const { t } = useI18n()
const session = useSession()
const settings = useSettings()
const theme = useTheme()
const registry = useAppRegistry()
const wm = useWindowManager()
const appName = useAppName()

const sep = computed(() => (settings.lang.startsWith('zh') ? '、' : ', '))
const rolesText = computed(
  () =>
    session.currentRoles.map((r) => t(`settings.roles.${r.id}`)).join(sep.value) ||
    t('settings.account.none'),
)
const permsText = computed(() => {
  const perms = session.effectivePermissions
  if (perms.includes('*')) return t('settings.account.allPerms')
  return perms.length ? perms.join(sep.value) : t('settings.account.publicOnly')
})

const modeOptions = computed(() =>
  MODES.map((m) => ({ value: m, label: t(`settings.appearance.${m}`) })),
)
const accentOptions = computed(() =>
  ACCENT_KEYS.map((a) => ({ value: a, label: t(`settings.appearance.accents.${a}`) })),
)
const langOptions = computed(() =>
  LOCALES.map((l) => ({ value: l, label: t(`settings.appearance.languages.${l}`) })),
)
const wallpaperSuffix = computed(() => theme.wallpaper.replace('wallpaper-', ''))

function onMode(v: string) {
  theme.setMode(v as ThemeMode)
}
function onAccent(v: string) {
  theme.setAccent(v as AccentKey)
}
function onLang(v: string) {
  settings.setLang(v as Locale)
}

function resetLayout() {
  const ids = wm.windows.map((w) => w.id)
  for (const id of ids) wm.close(id)
}
</script>

<template>
  <div class="h-full overflow-y-auto text-ui text-ink">
    <!-- 用户与角色 -->
    <section class="border-b border-line p-4">
      <h2 class="mb-1 flex items-center gap-1.5 text-title font-medium">
        <OsIcon name="user" :size="15" class="text-accent-strong" />
        {{ t('settings.account.title') }}
      </h2>
      <p class="mb-3 text-caption text-ink-mute">{{ t('settings.account.hint') }}</p>
      <div class="flex flex-col gap-2">
        <button
          v-for="u in USERS"
          :key="u.id"
          class="flex items-center justify-between rounded-lg border px-3 py-2 text-left transition"
          :class="
            session.currentUserId === u.id
              ? 'border-accent bg-accent-soft'
              : 'border-line hover:bg-surface-hover'
          "
          @click="session.setUser(u.id)"
        >
          <span>
            <span class="block font-medium">{{ t(`settings.users.${u.id}.name`) }}</span>
            <span class="block text-caption text-ink-mute">{{
              t(`settings.users.${u.id}.desc`)
            }}</span>
          </span>
          <OsIcon
            v-if="session.currentUserId === u.id"
            name="check"
            :size="16"
            class="text-accent-strong"
          />
        </button>
      </div>
      <p class="mt-2 text-caption text-ink-mute">
        {{ t('settings.account.current', { roles: rolesText, perms: permsText }) }}
      </p>
    </section>

    <!-- 外观 -->
    <section class="border-b border-line p-4">
      <h2 class="mb-3 flex items-center gap-1.5 text-title font-medium">
        <OsIcon name="sparkles" :size="15" class="text-accent-strong" />
        {{ t('settings.appearance.title') }}
      </h2>
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <span class="w-20 shrink-0 text-ink-mute">{{ t('settings.appearance.wallpaper') }}</span>
          <span class="mr-1">{{ t(`settings.appearance.wallpapers.${wallpaperSuffix}`) }}</span>
          <OsButton size="sm" @click="theme.cycleWallpaper()">
            {{ t('settings.appearance.switchWallpaper') }}
          </OsButton>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <span class="w-20 shrink-0 text-ink-mute">{{ t('settings.appearance.mode') }}</span>
          <OsRadio
            :model-value="theme.mode"
            :options="modeOptions"
            name="theme-mode"
            @update:model-value="onMode"
          />
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <span class="w-20 shrink-0 text-ink-mute">{{ t('settings.appearance.accent') }}</span>
          <OsRadio
            :model-value="theme.accent"
            :options="accentOptions"
            name="theme-accent"
            @update:model-value="onAccent"
          />
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <span class="w-20 shrink-0 text-ink-mute">{{ t('settings.appearance.language') }}</span>
          <OsRadio
            :model-value="settings.lang"
            :options="langOptions"
            name="app-lang"
            @update:model-value="onLang"
          />
        </div>
      </div>
    </section>

    <!-- Dock 固定项 -->
    <section class="border-b border-line p-4">
      <h2 class="mb-1 flex items-center gap-1.5 text-title font-medium">
        <OsIcon name="boxes" :size="15" class="text-accent-strong" />
        {{ t('settings.dock.title') }}
      </h2>
      <p class="mb-3 text-caption text-ink-mute">{{ t('settings.dock.hint') }}</p>
      <div class="grid grid-cols-2 gap-2">
        <label
          v-for="app in registry.accessibleApps"
          :key="app.id"
          class="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 hover:bg-surface-hover"
        >
          <input
            type="checkbox"
            :checked="settings.isPinned(app.id, app.dock !== false)"
            @change="settings.togglePinned(app.id, app.dock !== false)"
          />
          <OsIcon :name="app.icon" :size="16" class="text-ink-mute" />
          <span>{{ appName(app) }}</span>
        </label>
      </div>
      <OsButton size="sm" class="mt-3" @click="settings.resetDock()">
        {{ t('settings.dock.reset') }}
      </OsButton>
    </section>

    <!-- 窗口 -->
    <section class="border-b border-line p-4">
      <h2 class="mb-3 flex items-center gap-1.5 text-title font-medium">
        <OsIcon name="puzzle" :size="15" class="text-accent-strong" />
        {{ t('settings.window.title') }}
      </h2>
      <div class="flex gap-2">
        <OsButton size="sm" @click="wm.cascadeAll()">{{ t('settings.window.cascade') }}</OsButton>
        <OsButton size="sm" variant="danger" @click="resetLayout">
          {{ t('settings.window.closeAll') }}
        </OsButton>
      </div>
    </section>

    <!-- 系统信息 -->
    <section class="p-4">
      <h2 class="mb-3 flex items-center gap-1.5 text-title font-medium">
        <OsIcon name="shield" :size="15" class="text-accent-strong" />
        {{ t('settings.system.title') }}
      </h2>
      <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-caption">
        <dt class="text-ink-mute">{{ t('settings.system.version') }}</dt>
        <dd>0.0.1</dd>
        <dt class="text-ink-mute">{{ t('settings.system.registered') }}</dt>
        <dd>{{ registry.apps.length }}</dd>
        <dt class="text-ink-mute">{{ t('settings.system.accessible') }}</dt>
        <dd>{{ registry.accessibleApps.length }}</dd>
        <dt class="text-ink-mute">{{ t('settings.system.wallpapers') }}</dt>
        <dd>{{ WALLPAPER_KEYS.length }}</dd>
      </dl>
    </section>
  </div>
</template>
