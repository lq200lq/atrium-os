<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import OsIcon from '@/components/OsIcon.vue'
import OsBadge from '@/ui/OsBadge.vue'
import { useNotification } from '@/kernel/stores/notification'
import { useShellUi } from '@/kernel/stores/shellUi'

const ui = useShellUi()
const notif = useNotification()

const menus = ['工作台', '文件', '编辑', '视图', '应用', '窗口', '帮助']
const now = ref(new Date())
const timer = setInterval(() => (now.value = new Date()), 1000)
onUnmounted(() => clearInterval(timer))

const time = () =>
  now.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
const date = () =>
  now.value.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
</script>

<template>
  <header
    class="fixed inset-x-0 top-0 z-[9999] flex h-11 items-center gap-3 border-b border-glass-border bg-glass-bar px-4 backdrop-blur-xl"
  >
    <div class="flex shrink-0 items-center gap-2 whitespace-nowrap">
      <div
        class="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow"
      >
        <OsIcon name="boxes" :size="14" />
      </div>
      <span class="text-ui font-semibold text-ink-strong">万物皆应用</span>
    </div>

    <nav class="flex shrink-0 items-center gap-0.5">
      <button
        v-for="m in menus"
        :key="m"
        class="whitespace-nowrap rounded px-2 py-0.5 text-ui text-ink hover:bg-glass-raise"
      >
        {{ m }}
      </button>
    </nav>

    <div class="min-w-0 flex-1 px-4">
      <button
        class="flex w-full max-w-md items-center gap-2 rounded-full border border-glass-border bg-glass-raise px-4 py-1 text-left text-ui text-ink-mute hover:bg-glass-base"
        @click="ui.openSpotlight()"
      >
        <OsIcon name="search" :size="14" class="text-ink-mute" />
        <span class="flex-1 truncate">搜索应用、文件、知识…</span>
        <kbd class="rounded border border-slate-300/60 px-1 text-micro text-ink-mute">⌘K</kbd>
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
