<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OsButton from '@/ui/OsButton.vue'
import OsCheckbox from '@/ui/OsCheckbox.vue'
import OsEmpty from '@/ui/OsEmpty.vue'
import OsIcon from '@/components/OsIcon.vue'
import OsInput from '@/ui/OsInput.vue'
import OsSegmented from '@/ui/OsSegmented.vue'
import { parentOf, baseName } from '@/kernel/fs/types'
import { useWindowContext } from '@/kernel/composables/useWindowContext'
import { useVfs } from '@/kernel/stores/vfs'
import {
  DATA_ROOT,
  JSON_MIME,
  readWidgetDataJson,
  releaseWidgetData,
} from '@/kernel/widget/widgetData'
import {
  EVENTS_KEY,
  TASKS_KEY,
  newId,
  normalizeEvents,
  normalizeTasks,
  sortTasks,
  toIsoDay,
  emptyEvents,
  emptyTasks,
  type EventFile,
  type IsoDay,
  type ScheduleEvent,
  type Task,
  type TaskFile,
} from '@/kernel/widget/taskSchedule'
import { useFeedback } from '@/ui/feedback'

/**
 * 「今日」＝ tasks/events 两个区块，数据一律落 VFS `/我的数据/<key>.json`（§4.2 决策 2）。
 * 下钻 payload（§4.5 第 3 项）：月历给 `{ date }` → 日程定位到那一天；待办给 `{ scope }` → 切筛选。
 * 读取方式与既有应用一致（doc-editor 同构）：useWindowContext() → win.payload。
 */
const { t, locale } = useI18n()
const vfs = useVfs()
const feedback = useFeedback()
const { win } = useWindowContext()

const TASKS_PATH = `${DATA_ROOT}/${TASKS_KEY}.json`
const EVENTS_PATH = `${DATA_ROOT}/${EVENTS_KEY}.json`

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

function today(): IsoDay {
  return toIsoDay(new Date())
}

/** `YYYY-MM-DD` → 本地零点（不写 `new Date(iso)`，那会按 UTC 解析导致跨日漂移） */
function fromIsoDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function fmtDay(iso: string): string {
  return new Intl.DateTimeFormat(locale.value, {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(fromIsoDay(iso))
}

/* ── 读取（读入即规整，脏条目整项丢弃） ───────────────────────────── */

function parseFile<T>(raw: string | undefined, normalize: (v: unknown) => T, fallback: () => T): T {
  if (raw === undefined || raw === '') return fallback()
  try {
    return normalize(JSON.parse(raw))
  } catch {
    return fallback()
  }
}

const tasksFile = computed(() =>
  parseFile(readWidgetDataJson(vfs, TASKS_PATH), normalizeTasks, emptyTasks),
)
const eventsFile = computed(() =>
  parseFile(readWidgetDataJson(vfs, EVENTS_PATH), normalizeEvents, emptyEvents),
)

/* ── 写回：先补齐 `/我的数据` 与两个文件，之后一律 updateContent ──── */

/**
 * 这两个文件是 `shared` 域，写者不止本应用（待办卡往同一条路径写）。因此读写都走 §4.2 的那一条边：
 * 读时把小组件防抖窗口里挂着的值算进当前真相，写完 VFS 就把那份挂账作废——
 * 否则卡片那一次 flush 会拿旧底把本应用刚写的这条倒回去（功能设计 §8 偏差 16）。
 */
function writeJson(path: string, file: TaskFile | EventFile) {
  if (!vfs.ready) return
  if (!vfs.byPath(DATA_ROOT)) vfs.mkdir(parentOf(DATA_ROOT), baseName(DATA_ROOT))
  if (vfs.byPath(path)) vfs.updateContent(path, JSON.stringify(file))
  else vfs.writeFile(DATA_ROOT, baseName(path), JSON.stringify(file), JSON_MIME)
  releaseWidgetData(path)
}

// VFS 晚于本组件就绪（首屏并发还原）：就绪后给缺失的文件落空默认值，避免「空」与「未初始化」纠缠
watch(
  () => vfs.ready,
  (ready) => {
    if (!ready) return
    // 挂账也算「已有内容」：件侧排队的那一条不能被这里的空默认值倒回去
    if (readWidgetDataJson(vfs, TASKS_PATH) === undefined) writeJson(TASKS_PATH, emptyTasks())
    if (readWidgetDataJson(vfs, EVENTS_PATH) === undefined) writeJson(EVENTS_PATH, emptyEvents())
  },
  { immediate: true },
)

function saveTasks(tasks: Task[]) {
  writeJson(TASKS_PATH, { version: 1, tasks })
}
function saveEvents(events: ScheduleEvent[]) {
  writeJson(EVENTS_PATH, { version: 1, events })
}

/* ── 下钻 payload：date 定位日程，scope 切清单筛选 ─────────────────── */

type Scope = 'today' | 'week' | 'all'
const scope = ref<Scope>('all')
const agendaDay = ref<IsoDay>(today())

const payload = computed(() => win.value?.payload as { date?: string; scope?: string } | undefined)
watch(
  payload,
  (p) => {
    if (!p) return
    if (typeof p.date === 'string' && ISO_DAY.test(p.date)) agendaDay.value = p.date
    if (p.scope === 'today' || p.scope === 'week' || p.scope === 'all') scope.value = p.scope
  },
  { immediate: true },
)

/* ── 任务清单 ─────────────────────────────────────────────────────── */

/** 筛选取值与待办件 scope 同为 today|week|all；标签直接复用语言包既有键 */
const scopeOptions = computed(() => [
  { value: 'today', label: t('widgets.configOptions.scope.today') },
  { value: 'week', label: t('widgets.configOptions.scope.week') },
  { value: 'all', label: t('widgets.configOptions.scope.all') },
])

/** 与待办件 scope 同一套取值 today|week|all；周界取周一为一周之首 */
function inWeek(iso: string): boolean {
  const now = new Date()
  const shift = (now.getDay() + 6) % 7
  const mon = new Date(now)
  mon.setDate(now.getDate() - shift)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return iso >= toIsoDay(mon) && iso <= toIsoDay(sun)
}

const visibleTasks = computed(() => {
  const all = tasksFile.value.tasks
  const day = today()
  const list =
    scope.value === 'today'
      ? all.filter((k) => k.due === day)
      : scope.value === 'week'
        ? all.filter((k) => k.due !== undefined && inWeek(k.due))
        : all
  return sortTasks(list)
})

const newTitle = ref('')

function addTask() {
  const title = newTitle.value.trim()
  if (!title) return
  saveTasks([
    ...tasksFile.value.tasks,
    { id: newId('t'), title, done: false, due: today(), createdAt: Date.now() },
  ])
  newTitle.value = ''
}

function toggleTask(id: string) {
  saveTasks(tasksFile.value.tasks.map((k) => (k.id === id ? { ...k, done: !k.done } : k)))
}

async function removeTask(task: Task) {
  // 分级反馈（§4.5 第 4 项）：勾选不弹确认，删除要过一次确认
  const ok = await feedback.confirm({
    title: t('today.deleteTask'),
    content: t('today.deleteConfirmBody', { title: task.title }),
    okText: t('today.deleteTask'),
  })
  if (!ok) return
  saveTasks(tasksFile.value.tasks.filter((k) => k.id !== task.id))
}

/* ── 日程 ─────────────────────────────────────────────────────────── */

const evTitle = ref('')
const evDate = ref(today())
const evStart = ref('')

const focusEvents = computed(() =>
  eventsFile.value.events
    .filter((e) => e.date === agendaDay.value)
    .sort((a, b) => (a.start ?? '99:99').localeCompare(b.start ?? '99:99')),
)

/** 其余日期按日升序排在「今天/定位日」之后；没有任何日程的日期不渲染（降级即整项不渲染） */
const otherGroups = computed(() => {
  const byDay = new Map<IsoDay, ScheduleEvent[]>()
  for (const e of eventsFile.value.events) {
    if (e.date === agendaDay.value) continue
    ;(byDay.get(e.date) ?? byDay.set(e.date, []).get(e.date)!).push(e)
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, items]) => ({
      day,
      label: fmtDay(day),
      items: items.sort((x, y) => (x.start ?? '99:99').localeCompare(y.start ?? '99:99')),
    }))
})

const isAgendaToday = computed(() => agendaDay.value === today())

function addEvent() {
  const title = evTitle.value.trim()
  const date = evDate.value.trim()
  if (!title || !ISO_DAY.test(date)) {
    if (title) feedback.warning(t('today.eventsTitle'), t('today.invalidDate'))
    return
  }
  const start = HHMM.test(evStart.value.trim()) ? evStart.value.trim() : undefined
  saveEvents([...eventsFile.value.events, { id: newId('e'), title, date, start }])
  evTitle.value = ''
  evStart.value = ''
  agendaDay.value = date
}
</script>

<template>
  <div class="cq-window flex h-full flex-col gap-sm p-md text-ui text-ink">
    <header class="flex shrink-0 flex-wrap items-center gap-sm">
      <h1 class="text-heading-2 font-strong">{{ t('today.title') }}</h1>
      <span class="flex-1" />
      <OsSegmented
        v-model="scope"
        :options="scopeOptions"
        :label="t('today.scopeLabel')"
        size="sm"
      />
    </header>

    <div class="grid min-h-0 flex-1 grid-cols-1 gap-md w-wide:grid-cols-2">
      <!-- 任务清单 -->
      <section class="flex min-h-0 flex-col gap-xs rounded-surface border border-line p-md">
        <div class="flex items-baseline gap-xs">
          <h2 class="text-title font-strong">{{ t('today.tasksTitle') }}</h2>
          <span class="text-caption text-ink-mute">
            {{ visibleTasks.filter((k) => !k.done).length }} / {{ visibleTasks.length }}
          </span>
        </div>

        <div class="flex shrink-0 items-center gap-2xs">
          <OsInput
            v-model="newTitle"
            :placeholder="t('today.newTaskPlaceholder')"
            :aria-label="t('today.newTaskPlaceholder')"
            class="min-w-0 flex-1"
            @enter="addTask"
          />
          <OsButton size="sm" @click="addTask">{{ t('today.add') }}</OsButton>
        </div>

        <ul v-if="visibleTasks.length" class="min-h-0 flex-1 overflow-y-auto">
          <li v-for="task in visibleTasks" :key="task.id" class="flex h-6 items-center gap-xs">
            <OsCheckbox
              :model-value="task.done"
              :aria-label="task.title"
              @update:model-value="toggleTask(task.id)"
            />
            <button
              type="button"
              class="min-w-0 flex-1 truncate text-left"
              :class="task.done ? 'text-ink-mute line-through' : ''"
              @click="toggleTask(task.id)"
            >
              {{ task.title }}
            </button>
            <span
              v-if="task.due && scope !== 'today'"
              class="shrink-0 rounded-chip bg-fill px-2xs text-caption text-ink-mute"
            >
              {{ fmtDay(task.due) }}
            </span>
            <OsButton
              size="sm"
              class="shrink-0"
              :aria-label="t('today.deleteTask')"
              @click="removeTask(task)"
            >
              <OsIcon name="x" :size="12" class="text-ink-mute" />
            </OsButton>
          </li>
        </ul>
        <OsEmpty v-else :description="t('today.tasksEmpty')" />
      </section>

      <!-- 日程 -->
      <section class="flex min-h-0 flex-col gap-xs rounded-surface border border-line p-md">
        <div class="flex items-center gap-xs">
          <h2 class="text-title font-strong">{{ t('today.eventsTitle') }}</h2>
          <span class="flex-1" />
          <OsButton size="sm" :disabled="isAgendaToday" @click="agendaDay = today()">
            {{ t('today.todayTag') }}
          </OsButton>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto">
          <!-- 顶部固定一个日期分组：默认「今天」，月历下钻时定位到那一天 -->
          <div
            class="mb-xs rounded-surface border p-xs"
            :class="isAgendaToday ? 'border-accent-border bg-accent-soft/40' : 'border-line'"
          >
            <p class="mb-2xs text-caption font-strong">
              {{ fmtDay(agendaDay) }}
              <span v-if="isAgendaToday" class="text-accent-strong"
                >· {{ t('today.todayTag') }}</span
              >
            </p>
            <ul v-if="focusEvents.length">
              <li v-for="ev in focusEvents" :key="ev.id" class="flex h-6 items-center gap-xs">
                <span class="w-12 shrink-0 text-caption text-ink-mute">{{
                  ev.start || t('today.allDay')
                }}</span>
                <span class="min-w-0 flex-1 truncate">{{ ev.title }}</span>
              </li>
            </ul>
            <p v-else class="text-caption text-ink-mute">{{ t('today.eventsEmpty') }}</p>
          </div>

          <div v-for="group in otherGroups" :key="group.day" class="mb-xs">
            <p class="text-caption text-ink-mute">{{ group.label }}</p>
            <ul>
              <li v-for="ev in group.items" :key="ev.id" class="flex h-6 items-center gap-xs">
                <span class="w-12 shrink-0 text-caption text-ink-mute">{{
                  ev.start || t('today.allDay')
                }}</span>
                <span class="min-w-0 flex-1 truncate">{{ ev.title }}</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="flex shrink-0 flex-wrap items-center gap-2xs">
          <OsInput
            v-model="evTitle"
            :placeholder="t('today.newEventPlaceholder')"
            :aria-label="t('today.newEventPlaceholder')"
            class="w-40 min-w-0 flex-1"
            @enter="addEvent"
          />
          <OsInput
            v-model="evDate"
            :placeholder="t('today.eventDatePlaceholder')"
            :aria-label="t('today.eventDateLabel')"
            class="w-28 shrink-0"
          />
          <OsInput
            v-model="evStart"
            :placeholder="t('today.eventStartPlaceholder')"
            :aria-label="t('today.eventStartLabel')"
            class="w-20 shrink-0"
            @enter="addEvent"
          />
          <OsButton size="sm" @click="addEvent">{{ t('today.add') }}</OsButton>
        </div>
      </section>
    </div>
  </div>
</template>
