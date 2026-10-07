<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import { LOCALES } from '@/i18n'
import { useWidgetContext } from '@/kernel/composables/useWidgetContext'
import { useSettings } from '@/kernel/stores/settings'
import {
  ACCENT_KEYS,
  MODES,
  WALLPAPER_KEYS,
  useTheme,
  type AccentKey,
  type WallpaperKey,
} from '@/kernel/stores/theme'

const { size } = useWidgetContext()
const theme = useTheme()
const settings = useSettings()
const { t } = useI18n()

function chipClass(active: boolean): string {
  return [
    'flex h-6 min-w-6 items-center justify-center gap-2xs rounded-chip px-xs text-caption transition duration-quick',
    active
      ? 'bg-widget-fill font-strong text-widget-ink'
      : 'text-widget-ink-mute hover:bg-widget-fill',
  ].join(' ')
}

function pickWallpaper(key: WallpaperKey) {
  theme.setWallpaper(key)
}

const accentLabels: Record<AccentKey, string> = {
  sky: 'widgets.control.accents.sky',
  violet: 'widgets.control.accents.violet',
  emerald: 'widgets.control.accents.emerald',
  rose: 'widgets.control.accents.rose',
}
</script>

<template>
  <div class="h-full flex flex-col justify-between gap-2xs">
    <div class="flex items-center justify-between gap-xs">
      <span class="shrink-0 text-caption text-widget-ink-mute">{{
        t('widgets.control.theme')
      }}</span>
      <div class="flex flex-wrap justify-end gap-2xs">
        <button
          v-for="mode in MODES"
          :key="mode"
          type="button"
          :class="chipClass(theme.mode === mode)"
          :aria-pressed="theme.mode === mode"
          @click="theme.setMode(mode)"
        >
          <!-- 静态 name：`icons:gen` 只认字面量，映射表里的名字不会进白名单（OsIcon 未登记时静默回落成 file 图标） -->
          <OsIcon v-if="mode === 'light'" name="sun" :size="12" />
          <OsIcon v-else name="moon" :size="12" />
          <OsIcon v-if="theme.mode === mode" name="check" :size="12" />
          {{ t(`widgets.control.${mode}`) }}
        </button>
      </div>
    </div>

    <div class="flex items-center justify-between gap-xs">
      <span class="shrink-0 text-caption text-widget-ink-mute">{{
        t('widgets.control.accent')
      }}</span>
      <div class="flex flex-wrap justify-end gap-2xs">
        <button
          v-for="accent in ACCENT_KEYS"
          :key="accent"
          type="button"
          :class="chipClass(theme.accent === accent)"
          :aria-pressed="theme.accent === accent"
          @click="theme.setAccent(accent)"
        >
          <OsIcon v-if="theme.accent === accent" name="check" :size="12" />
          {{ t(accentLabels[accent]) }}
        </button>
      </div>
    </div>

    <div class="flex items-center justify-between gap-xs">
      <span class="flex shrink-0 items-center gap-2xs text-caption text-widget-ink-mute"
        ><OsIcon name="image" :size="12" />{{ t('widgets.control.wallpaper') }}</span
      >
      <div class="flex flex-wrap justify-end gap-2xs">
        <button
          v-for="key in WALLPAPER_KEYS"
          :key="key"
          type="button"
          :class="chipClass(theme.wallpaper === key)"
          :aria-pressed="theme.wallpaper === key"
          @click="pickWallpaper(key)"
        >
          <OsIcon v-if="theme.wallpaper === key" name="check" :size="12" />
          {{ t(`widgets.control.wallpapers.${key}`) }}
        </button>
      </div>
    </div>

    <div class="flex items-center justify-between gap-xs">
      <span class="flex shrink-0 items-center gap-2xs text-caption text-widget-ink-mute"
        ><OsIcon name="languages" :size="12" />{{ t('widgets.control.language') }}</span
      >
      <div class="flex flex-wrap justify-end gap-2xs">
        <button
          v-for="lang in LOCALES"
          :key="lang"
          type="button"
          :class="chipClass(settings.lang === lang)"
          :aria-pressed="settings.lang === lang"
          @click="settings.setLang(lang)"
        >
          <OsIcon v-if="settings.lang === lang" name="check" :size="12" />
          {{ t(`widgets.control.langs.${lang}`) }}
        </button>
      </div>
    </div>

    <button
      v-if="size === 'lg'"
      type="button"
      class="flex h-6 w-full items-center justify-center gap-2xs rounded-chip bg-widget-fill text-caption font-strong text-widget-ink"
      @click="settings.resetDock()"
    >
      <OsIcon name="rotate-ccw" :size="12" />
      {{ t('widgets.control.dockReset') }}
    </button>
  </div>
</template>
