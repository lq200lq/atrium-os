<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import OsBadge from '@/ui/OsBadge.vue'
import { useNotification } from '@/kernel/stores/notification'
import { useSettings } from '@/kernel/stores/settings'
import { useShellUi } from '@/kernel/stores/shellUi'

const ui = useShellUi()
const notif = useNotification()
const settings = useSettings()
const { t } = useI18n()

const menus = ['workbench', 'file', 'edit', 'view', 'app', 'window', 'help'] as const
const now = ref(new Date())
const timer = setInterval(() => (now.value = new Date()), 1000)
onUnmounted(() => clearInterval(timer))

const time = () =>
  now.value.toLocaleTimeString(settings.lang, { hour: '2-digit', minute: '2-digit', hour12: false })
const date = () =>
  now.value.toLocaleDateString(settings.lang, { month: 'long', day: 'numeric', weekday: 'short' })
</script>

<template>
  <header
    class="fixed inset-x-0 top-0 z-shell flex h-11 items-center gap-3 border-b border-glass-border bg-glass-bar px-4 backdrop-blur-xl"
  >
    <div class="flex shrink-0 items-center gap-2 whitespace-nowrap">
      <div
        class="flex h-6 w-6 items-center justify-center rounded-control bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow"
      >
        <OsIcon name="boxes" :size="14" />
      </div>
      <span class="text-ui font-strong text-ink-strong">{{ t('brand.slogan') }}</span>
    </div>

    <nav class="flex shrink-0 items-center gap-2xs">
      <button
        v-for="m in menus"
        :key="m"
        class="inline-flex h-control-sm items-center whitespace-nowrap rounded-chip px-xs text-ui text-ink hover:bg-glass-raise"
      >
        {{ t(`topbar.menus.${m}`) }}
      </button>
    </nav>

    <div class="min-w-0 flex-1 px-4">
      <button
        class="flex w-full max-w-md items-center gap-2 rounded-full border border-glass-border bg-glass-raise px-4 py-1 text-left text-ui text-ink-mute hover:bg-glass-base"
        @click="ui.openSpotlight()"
      >
        <OsIcon name="search" :size="14" class="text-ink-mute" />
        <span class="flex-1 truncate">{{ t('topbar.search') }}</span>
        <kbd class="rounded-chip border border-line px-1 text-micro text-ink-mute">⌘K</kbd>
      </button>
    </div>

    <div class="flex shrink-0 items-center gap-3 whitespace-nowrap text-ui text-ink">
      <button class="relative" @click="ui.toggleNotifications()">
        <OsIcon name="bell" :size="16" />
        <OsBadge class="absolute -right-1.5 -top-1" :count="notif.unread" />
      </button>
      <OsIcon name="wifi" :size="15" />
      <OsIcon name="battery-full" :size="15" />
      <span class="tabular-nums">{{ time() }} {{ date() }}</span>
    </div>
  </header>
</template>
