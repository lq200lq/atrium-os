<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import OsIcon from '@/components/OsIcon.vue'

const now = ref(new Date())
const timer = setInterval(() => (now.value = new Date()), 1000)
onUnmounted(() => clearInterval(timer))

const clock = computed(() =>
  now.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
)
const dateLine = computed(() =>
  now.value.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }),
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
  { text: '评审智慧园区方案 v1', done: true },
  { text: '整理技术文档归档', done: false },
  { text: '准备周五项目汇报', done: false },
])
</script>

<template>
  <div
    class="pointer-events-none absolute right-4 top-14 z-[5] hidden w-60 flex-col gap-3 xl:flex"
  >
    <div class="pointer-events-auto rounded-2xl border border-white/40 bg-white/25 p-4 text-white shadow-lg backdrop-blur-xl">
      <p class="text-4xl font-light tabular-nums drop-shadow">{{ clock }}</p>
      <p class="mt-1 text-[13px] opacity-90">{{ dateLine }}</p>
    </div>

    <div class="pointer-events-auto rounded-2xl border border-white/40 bg-white/25 p-4 text-white shadow-lg backdrop-blur-xl">
      <div class="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] opacity-70">
        <span v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w">{{ w }}</span>
      </div>
      <div class="grid grid-cols-7 gap-1 text-center text-[11px]">
        <span
          v-for="(c, i) in cells"
          :key="i"
          class="flex h-6 items-center justify-center rounded-md"
          :class="c.today ? 'bg-white text-sky-600 font-semibold' : 'opacity-80'"
        >
          {{ c.day || '' }}
        </span>
      </div>
    </div>

    <div class="pointer-events-auto rounded-2xl border border-white/40 bg-white/25 p-4 text-white shadow-lg backdrop-blur-xl">
      <p class="mb-2 text-[13px] font-medium">今日事项</p>
      <ul class="space-y-1.5">
        <li v-for="(t, i) in todos" :key="i">
          <button
            class="flex w-full items-center gap-2 text-left text-[12px]"
            @click="t.done = !t.done"
          >
            <span
              class="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-white/60 text-[10px]"
              :class="t.done ? 'bg-white/80 text-sky-600' : ''"
            >
              <OsIcon v-if="t.done" name="check" :size="10" :stroke-width="3" />
            </span>
            <span :class="t.done ? 'opacity-50 line-through' : ''">{{ t.text }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
