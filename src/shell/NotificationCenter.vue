<script setup lang="ts">
import OsIcon from '@/components/OsIcon.vue'
import { useNotification } from '@/kernel/stores/notification'
import { useShellUi } from '@/kernel/stores/shellUi'

const ui = useShellUi()
const notif = useNotification()

const fmt = (t: number) =>
  new Date(t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
</script>

<template>
  <aside
    v-if="ui.notificationsOpen"
    class="fixed right-3 top-12 z-[9998] flex max-h-[60vh] w-80 flex-col overflow-hidden rounded-xl border border-white/50 bg-white/90 shadow-2xl backdrop-blur-xl"
  >
    <div class="flex items-center justify-between border-b border-slate-200/70 px-4 py-2 text-[13px]">
      <span class="font-medium text-slate-700">通知（{{ notif.items.length }}）</span>
      <button class="text-slate-400 hover:text-slate-600" @click="notif.clearAll()">清空</button>
    </div>
    <ul class="min-h-0 flex-1 overflow-y-auto">
      <li
        v-for="n in notif.items"
        :key="n.id"
        class="flex items-start gap-2 border-b border-slate-100 px-4 py-2.5 text-[13px]"
      >
        <div class="min-w-0 flex-1">
          <p class="font-medium text-slate-700">{{ n.title }}</p>
          <p v-if="n.body" class="truncate text-slate-500">{{ n.body }}</p>
          <p class="mt-0.5 text-[11px] text-slate-400">{{ fmt(n.time) }}</p>
        </div>
        <button class="text-slate-300 hover:text-slate-500" title="关闭" @click="notif.dismiss(n.id)">
          <OsIcon name="x" :size="14" />
        </button>
      </li>
      <li v-if="notif.items.length === 0" class="px-4 py-8 text-center text-[13px] text-slate-400">
        暂无通知
      </li>
    </ul>
  </aside>
</template>
