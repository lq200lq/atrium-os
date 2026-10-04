<script setup lang="ts">
import { computed, ref } from 'vue'
import OsIcon from '@/components/OsIcon.vue'
import { useAppRegistry } from '@/kernel/stores/appRegistry'
import { useWindowManager } from '@/kernel/stores/windowManager'

const registry = useAppRegistry()
const wm = useWindowManager()
const q = ref('')

const apps = computed(() => {
  const kw = q.value.trim().toLowerCase()
  if (!kw) return registry.accessibleApps
  return registry.accessibleApps.filter(
    (a) =>
      a.name.toLowerCase().includes(kw) ||
      a.id.includes(kw) ||
      a.keywords?.some((k) => k.toLowerCase().includes(kw)),
  )
})
</script>

<template>
  <div class="flex h-full flex-col text-ui">
    <div class="border-b border-slate-200/70 p-3">
      <input
        v-model="q"
        class="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 outline-none focus:border-indigo-400 focus:bg-white"
        placeholder="搜索应用…"
      />
    </div>
    <div class="grid flex-1 grid-cols-4 content-start gap-3 overflow-y-auto p-4">
      <button
        v-for="app in apps"
        :key="app.id"
        class="flex flex-col items-center gap-1.5 rounded-xl p-3 hover:bg-indigo-50"
        @click="wm.open(app.id)"
      >
        <span
          :class="[
            'flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl shadow',
            app.tint ?? 'from-slate-400 to-slate-500',
          ]"
        >
          <OsIcon :name="app.icon" :size="26" class="text-white" />
        </span>
        <span class="text-ink">{{ app.name }}</span>
        <span class="text-caption text-ink-mute">{{ app.singleton ? '单例' : '多实例' }}</span>
      </button>
      <p v-if="apps.length === 0" class="col-span-4 py-10 text-center text-ink-mute">
        没有匹配的应用
      </p>
    </div>
  </div>
</template>
