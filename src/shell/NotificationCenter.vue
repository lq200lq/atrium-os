<script setup lang="ts">
import OsIcon from '@/components/OsIcon.vue'
import { useOS } from '@/kernel/composables/useOS'
import { useNotification, type Notice } from '@/kernel/stores/notification'
import { useShellUi } from '@/kernel/stores/shellUi'

const ui = useShellUi()
const notif = useNotification()
const os = useOS()

const fmt = (t: number) =>
  new Date(t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })

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
    <div class="flex items-center justify-between border-b border-slate-200/70 px-4 py-2 text-ui">
      <span class="font-medium text-ink">通知（{{ notif.items.length }}）</span>
      <button class="text-ink-mute hover:text-ink" @click="notif.clearAll()">清空</button>
    </div>
    <ul class="min-h-0 flex-1 overflow-y-auto">
      <li
        v-for="n in notif.items"
        :key="n.id"
        class="flex items-start gap-2 border-b border-slate-100 px-4 py-2.5 text-ui"
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
        <button class="text-ink-mute hover:text-ink" title="关闭" @click="notif.dismiss(n.id)">
          <OsIcon name="x" :size="14" />
        </button>
      </li>
      <li v-if="notif.items.length === 0" class="px-4 py-8 text-center text-ui text-ink-mute">
        暂无通知
      </li>
    </ul>
  </aside>
</template>
