<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import { useOS } from '@/kernel/composables/useOS'
import { useNotification, type Notice } from '@/kernel/stores/notification'
import { useSettings } from '@/kernel/stores/settings'
import { useShellUi } from '@/kernel/stores/shellUi'

const ui = useShellUi()
const notif = useNotification()
const os = useOS()
const settings = useSettings()
const { t } = useI18n()

const fmt = (time: number) =>
  new Date(time).toLocaleTimeString(settings.lang, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

function runAction(n: Notice) {
  if (!n.action) return
  os.exec(`${n.action.appId}:open`)
  notif.dismiss(n.id)
}
</script>

<template>
  <aside
    v-if="ui.notificationsOpen"
    class="fixed right-3 top-12 z-[9998] flex max-h-[60vh] w-80 flex-col overflow-hidden rounded-xl border border-glass-border-active bg-glass-pop shadow-pop backdrop-blur-xl"
  >
    <div class="flex items-center justify-between border-b border-line px-4 py-2 text-ui">
      <span class="font-medium text-ink"
        >{{ t('notification.title') }} ({{ notif.items.length }})</span
      >
      <button class="text-ink-mute hover:text-ink" @click="notif.clearAll()">
        {{ t('notification.clear') }}
      </button>
    </div>
    <ul class="min-h-0 flex-1 overflow-y-auto">
      <li
        v-for="n in notif.items"
        :key="n.id"
        class="flex items-start gap-2 border-b border-line-soft px-4 py-2.5 text-ui"
      >
        <div class="min-w-0 flex-1">
          <p class="font-medium text-ink">{{ n.title }}</p>
          <p v-if="n.body" class="truncate text-ink-mute">{{ n.body }}</p>
          <button
            v-if="n.action"
            class="mt-1 rounded border border-accent/40 px-2 py-0.5 text-caption text-accent-strong hover:bg-accent-soft"
            @click="runAction(n)"
          >
            {{ n.action.label }}
          </button>
          <p class="mt-0.5 text-caption text-ink-mute">{{ fmt(n.time) }}</p>
        </div>
        <button
          class="text-ink-mute hover:text-ink"
          :title="t('notification.close')"
          @click="notif.dismiss(n.id)"
        >
          <OsIcon name="x" :size="14" />
        </button>
      </li>
      <li v-if="notif.items.length === 0" class="px-4 py-8 text-center text-ui text-ink-mute">
        {{ t('notification.empty') }}
      </li>
    </ul>
  </aside>
</template>
