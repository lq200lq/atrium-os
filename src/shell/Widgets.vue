<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'

const { t, tm, rt } = useI18n()
const now = ref(new Date())
const timer = setInterval(() => (now.value = new Date()), 1000)
onUnmounted(() => clearInterval(timer))

const clock = computed(() =>
  now.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
)
const dateLine = computed(() =>
  now.value.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }),
)

const weekdays = computed(() =>
  (tm('widget.weekdays') as unknown[]).map((m) => rt(m as Parameters<typeof rt>[0])),
)

// Monday-first month grid
const cells = computed(() => {
  const d = now.value
  const year = d.getFullYear()
  const month = d.getMonth()
  const first = new Date(year, month, 1)
  // shift so Monday = 0
  const lead = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const out: { day: number; today: boolean }[] = []
  for (let i = 0; i < lead; i++) out.push({ day: 0, today: false })
  for (let day = 1; day <= daysInMonth; day++) {
    out.push({ day, today: day === d.getDate() })
  }
  return out
})

const todos = ref([
  { key: 'widget.todos.t1', done: true },
  { key: 'widget.todos.t2', done: false },
  { key: 'widget.todos.t3', done: false },
])
</script>

<template>
  <div
    class="pointer-events-none absolute right-4 top-14 z-desktop hidden w-60 flex-col gap-3 xl:flex"
  >
    <div
      class="pointer-events-auto rounded-dock border border-glass-border bg-glass-bar p-4 text-white shadow-dock backdrop-blur-xl"
    >
      <p class="text-display-2 font-regular tabular-nums drop-shadow">{{ clock }}</p>
      <p class="mt-1 text-ui opacity-90">{{ dateLine }}</p>
    </div>

    <div
      class="pointer-events-auto rounded-dock border border-glass-border bg-glass-bar p-4 text-white shadow-dock backdrop-blur-xl"
    >
      <div class="mb-2 grid grid-cols-7 gap-1 text-center text-micro opacity-70">
        <span v-for="(w, i) in weekdays" :key="i">{{ w }}</span>
      </div>
      <div class="grid grid-cols-7 gap-1 text-center text-caption">
        <span
          v-for="(c, i) in cells"
          :key="i"
          class="flex h-6 items-center justify-center rounded-chip"
          :class="c.today ? 'bg-surface text-accent-strong font-strong' : 'opacity-80'"
        >
          {{ c.day || '' }}
        </span>
      </div>
    </div>

    <div
      class="pointer-events-auto rounded-dock border border-glass-border bg-glass-bar p-4 text-white shadow-dock backdrop-blur-xl"
    >
      <p class="mb-2 text-ui font-strong">{{ t('widget.today') }}</p>
      <ul class="space-y-2xs">
        <li v-for="(todo, i) in todos" :key="i">
          <button
            class="flex w-full items-center gap-2 text-left text-caption"
            @click="todo.done = !todo.done"
          >
            <span
              class="flex h-4 w-4 shrink-0 items-center justify-center rounded-chip border border-glass-border-active text-micro"
              :class="todo.done ? 'bg-glass-strong text-accent-strong' : ''"
            >
              <OsIcon v-if="todo.done" name="check" :size="10" :stroke-width="3" />
            </span>
            <span :class="todo.done ? 'opacity-50 line-through' : ''">{{ t(todo.key) }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
