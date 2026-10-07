<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import OsAlert from '@/ui/OsAlert.vue'
import OsRadio from '@/ui/OsRadio.vue'
import OsResult from '@/ui/OsResult.vue'
import OsTag from '@/ui/OsTag.vue'
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
import { useWindowContext } from '@/kernel/composables/useWindowContext'
import { useErrorLog } from '@/kernel/observability/errorLog'
import { LOCALES, useAppName, type Locale } from '@/i18n'
import OsButton from '@/ui/OsButton.vue'

const { t } = useI18n()
const session = useSession()
const settings = useSettings()
const theme = useTheme()
const registry = useAppRegistry()
const wm = useWindowManager()
const errorLog = useErrorLog()
const appName = useAppName()
const { win } = useWindowContext()

const version = __APP_VERSION__

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString(settings.lang === 'en-US' ? 'en-US' : 'zh-CN')
}

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

/* ── 下钻落点（§4.5 / H-1）：快捷设置件给 `{ section: 'appearance' }`，
 * 这里把那一节滚进视口并上一次性高亮——不落首页。取值只认白名单，
 * 免得 payload 直接进选择器。 ───────────────────────────────────────── */
const SECTIONS = ['account', 'appearance', 'dock', 'window', 'diagnostics', 'system'] as const
const scroller = ref<HTMLElement | null>(null)
const focusedSection = ref<string | null>(null)
let focusTimer: ReturnType<typeof setTimeout> | null = null

function sectionFlash(id: string): string {
  return focusedSection.value === id ? 'bg-accent-soft' : ''
}

const sectionOf = computed(() => (win.value?.payload as { section?: string } | undefined)?.section)

function applySection(section: string | undefined) {
  if (!section || !SECTIONS.includes(section as (typeof SECTIONS)[number])) return
  const el = scroller.value?.querySelector<HTMLElement>(`[data-section="${section}"]`)
  if (!el) return
  el.scrollIntoView({ block: 'start' })
  focusedSection.value = section
  if (focusTimer) clearTimeout(focusTimer)
  focusTimer = setTimeout(() => (focusedSection.value = null), 1600)
}

/* 首开时 payload 在挂载前就位，而 setup 里的 immediate + nextTick 在异步 entry +
 * Suspense 下会早于 ref 绑定（实测 scroller 仍为 null，静默不滚），所以挂载后直接应用；
 * 窗口复用换段落（payload 变更）时 DOM 已在，走 watch 的变更路径。 */
onMounted(() => applySection(sectionOf.value))
watch(sectionOf, (section) => void nextTick(() => applySection(section)))
</script>

<template>
  <div ref="scroller" class="h-full overflow-y-auto text-ui text-ink">
    <!-- 用户与角色 -->
    <section
      data-section="account"
      class="border-b border-line p-4 transition-colors duration-base"
      :class="sectionFlash('account')"
    >
      <h2 class="mb-1 flex items-center gap-xs text-title font-strong">
        <OsIcon name="user" :size="15" class="text-accent-strong" />
        {{ t('settings.account.title') }}
      </h2>
      <p class="mb-3 text-caption text-ink-mute">{{ t('settings.account.hint') }}</p>
      <div class="flex flex-col gap-2">
        <button
          v-for="u in USERS"
          :key="u.id"
          class="flex items-center justify-between rounded-surface border px-3 py-2 text-left transition"
          :class="
            session.currentUserId === u.id
              ? 'border-accent bg-accent-soft'
              : 'border-line hover:bg-surface-hover'
          "
          @click="session.setUser(u.id)"
        >
          <span>
            <span class="block font-strong">{{ t(`settings.users.${u.id}.name`) }}</span>
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
    <section
      data-section="appearance"
      class="border-b border-line p-4 transition-colors duration-base"
      :class="sectionFlash('appearance')"
    >
      <h2 class="mb-3 flex items-center gap-xs text-title font-strong">
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
    <section
      data-section="dock"
      class="border-b border-line p-4 transition-colors duration-base"
      :class="sectionFlash('dock')"
    >
      <h2 class="mb-1 flex items-center gap-xs text-title font-strong">
        <OsIcon name="boxes" :size="15" class="text-accent-strong" />
        {{ t('settings.dock.title') }}
      </h2>
      <p class="mb-3 text-caption text-ink-mute">{{ t('settings.dock.hint') }}</p>
      <div class="grid grid-cols-2 gap-2">
        <label
          v-for="app in registry.accessibleApps"
          :key="app.id"
          class="flex cursor-pointer items-center gap-2 rounded-surface border border-line px-3 py-2 hover:bg-surface-hover"
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
    <section
      data-section="window"
      class="border-b border-line p-4 transition-colors duration-base"
      :class="sectionFlash('window')"
    >
      <h2 class="mb-3 flex items-center gap-xs text-title font-strong">
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

    <!-- 诊断：错误日志回看（说明走 OsAlert、级别走 OsTag、空态走 OsResult，不再手写 chip 与空文案） -->
    <section
      data-section="diagnostics"
      class="border-b border-line p-4 transition-colors duration-base"
      :class="sectionFlash('diagnostics')"
    >
      <h2 class="mb-1 flex items-center gap-xs text-title font-strong">
        <OsIcon name="activity" :size="15" class="text-accent-strong" />
        {{ t('settings.diagnostics.title') }}
      </h2>
      <OsAlert
        class="mb-3"
        type="info"
        :message="t('settings.diagnostics.summary', { n: errorLog.entries.length })"
        :description="t('settings.diagnostics.hint')"
      />
      <div v-if="errorLog.entries.length" class="flex flex-col gap-2xs">
        <div
          v-for="e in errorLog.entries"
          :key="e.id"
          class="rounded-surface border border-line bg-surface-sunken px-3 py-2 text-caption"
        >
          <div class="flex items-center gap-2">
            <OsTag status="error">{{ t(`settings.diagnostics.scope.${e.scope}`) }}</OsTag>
            <span v-if="e.appId" class="text-ink-mute">{{ e.appId }}</span>
            <span class="ml-auto text-ink-mute">{{ fmtTime(e.ts) }}</span>
          </div>
          <p class="mt-1 truncate text-ink" :title="e.stack || e.message">{{ e.message }}</p>
        </div>
      </div>
      <OsResult v-else status="success" :title="t('settings.diagnostics.okTitle')">
        {{ t('settings.diagnostics.okSubtitle') }}
      </OsResult>
      <OsButton
        size="sm"
        variant="danger"
        class="mt-3"
        :disabled="!errorLog.entries.length"
        @click="errorLog.clear()"
      >
        {{ t('settings.diagnostics.clear') }}
      </OsButton>
    </section>

    <!-- 系统信息 -->
    <section
      data-section="system"
      class="p-4 transition-colors duration-base"
      :class="sectionFlash('system')"
    >
      <h2 class="mb-3 flex items-center gap-xs text-title font-strong">
        <OsIcon name="shield" :size="15" class="text-accent-strong" />
        {{ t('settings.system.title') }}
      </h2>
      <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-caption">
        <dt class="text-ink-mute">{{ t('settings.system.version') }}</dt>
        <dd>{{ version }}</dd>
        <dt class="text-ink-mute">{{ t('settings.system.registered') }}</dt>
        <dd>{{ registry.apps.length }}</dd>
        <dt class="text-ink-mute">{{ t('settings.system.accessible') }}</dt>
        <dd>{{ registry.accessibleApps.length }}</dd>
        <dt class="text-ink-mute">{{ t('settings.system.wallpapers') }}</dt>
        <dd>{{ WALLPAPER_KEYS.length }}</dd>
        <dt class="text-ink-mute">{{ t('settings.system.license') }}</dt>
        <dd>Apache-2.0</dd>
        <dt class="text-ink-mute">{{ t('settings.system.repo') }}</dt>
        <dd>
          <a
            href="https://github.com/lq200lq/atrium-os"
            target="_blank"
            rel="noopener noreferrer"
            class="text-accent-strong hover:underline"
            >github.com/lq200lq/atrium-os</a
          >
        </dd>
      </dl>
    </section>
  </div>
</template>
