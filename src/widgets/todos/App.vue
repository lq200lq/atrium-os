<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import { useWidgetContext } from '@/kernel/composables/useWidgetContext'
import { useWidgetDrill } from '@/kernel/composables/useWidgetDrill'
import { useWidgetData } from '@/kernel/composables/useWidgetData'
import {
  TASKS_KEY,
  displayTitle,
  emptyTasks,
  newId,
  normalizeTasks,
  sampleTasks,
  sortTasks,
  toIsoDay,
  type Task,
  type TaskFile,
} from '@/kernel/widget/taskSchedule'

/**
 * 今日待办（批次 A）：主结论「今天要做完什么」。
 * md 给 3 行 + 「还有 N 项」，lg 按 `limit`（3–8）给行并在底部就地添加——两档都是同一份数据（VFS 单一真相）。
 * 已完成项除划线外带勾形（H-3），删除按钮 24×24（H-4）。
 */
const { t, te } = useI18n()
const { size, config, setSelected, preview } = useWidgetContext()
const { target, open } = useWidgetDrill()

const store = useWidgetData<TaskFile>(TASKS_KEY, () => (preview ? sampleTasks() : emptyTasks()))
const all = computed(() => normalizeTasks(store.data.value).tasks)

const todayIso = computed(() => toIsoDay(new Date()))
const scope = computed(() => String(config.value.scope ?? 'today'))

function startOfWeek(at: Date): Date {
  const d = new Date(at)
  const shift = (d.getDay() + 6) % 7 // 周一为首
  d.setDate(d.getDate() - shift)
  d.setHours(0, 0, 0, 0)
  return d
}

function inScope(task: Task): boolean {
  if (scope.value === 'all') return true
  if (!task.due) return false
  if (scope.value === 'today') return task.due >= todayIso.value && task.due <= todayIso.value
  const day = new Date(task.due + 'T00:00:00')
  const from = startOfWeek(new Date())
  const to = new Date(from)
  to.setDate(to.getDate() + 7)
  return day >= from && day < to
}

const scoped = computed(() => all.value.filter(inScope))
const shown = computed(() =>
  sortTasks(scoped.value.filter((task) => config.value.showCompleted === true || !task.done)),
)
const doneCount = computed(() => scoped.value.filter((task) => task.done).length)

/** md 的 R4 行预算是 4 行（含「还有 N 项」那一行），因此正文只给 3 条 */
const limit = computed(() =>
  size.value === 'lg' ? Math.min(8, Math.max(3, Number(config.value.limit ?? 5))) : 3,
)
const rows = computed(() => shown.value.slice(0, limit.value))
const rest = computed(() => Math.max(0, shown.value.length - rows.value.length))

const draft = ref('')
function add() {
  const title = draft.value.trim()
  if (!title) return
  const task: Task = {
    id: newId('t'),
    title,
    done: false,
    due: scope.value === 'all' ? undefined : todayIso.value,
    createdAt: Date.now(),
  }
  store.write({ version: 1, tasks: [...all.value, task] })
  draft.value = ''
}

function toggle(task: Task) {
  store.write({
    version: 1,
    tasks: all.value.map((i) => (i.id === task.id ? { ...i, done: !i.done } : i)),
  })
}

function remove(id: string) {
  store.write({ version: 1, tasks: all.value.filter((i) => i.id !== id) })
}

function titleOf(task: Task): string {
  return displayTitle(task, { preview, label: (key) => (te(key) ? t(key) : undefined) })
}

/** 标题行既报进度也是下钻入口（交互型件的「内容即答案 vs 去看全部」分界） */
function openList() {
  setSelected(todayIso.value)
  open()
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <!-- 同月历：件内不用 header/footer，landmark 是页面级的（见 calendar 的注释） -->
    <div class="flex shrink-0 items-center justify-between gap-2">
      <button
        type="button"
        class="flex min-w-0 items-baseline gap-2 rounded-control px-1 py-2xs text-left transition duration-quick hover:bg-widget-fill"
        :disabled="!target"
        :aria-label="t('widgets.openApp')"
        @click="openList"
      >
        <span class="truncate text-title text-widget-ink">{{ t('widgets.names.todos') }}</span>
        <span v-if="scoped.length" class="shrink-0 text-caption text-widget-ink-mute">
          {{ t('widgets.todos.progress', { done: doneCount, total: scoped.length }) }}
        </span>
      </button>
      <span v-if="scope !== 'today'" class="shrink-0 text-caption text-widget-ink-mute">
        {{ t(`widgets.configOptions.scope.${scope}`) }}
      </span>
    </div>

    <ul class="mt-1 flex min-h-0 flex-1 flex-col justify-start gap-1">
      <li v-if="!rows.length" class="px-1 py-2 text-caption text-widget-ink-mute">
        {{ scope === 'today' ? t('widgets.todos.empty') : t('widgets.todos.emptyOther') }}
      </li>
      <li
        v-for="task in rows"
        :key="task.id"
        class="group flex min-w-0 items-center gap-2"
        :data-widget-interactive="true"
      >
        <button
          type="button"
          role="checkbox"
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-control border border-widget-line text-widget-ink-mute transition duration-quick hover:bg-widget-fill"
          :class="task.done ? 'bg-widget-fill text-widget-ink' : ''"
          :aria-checked="task.done"
          :aria-label="t('widgets.todos.doneAria')"
          @click="toggle(task)"
        >
          <OsIcon v-if="task.done" name="check" :size="12" />
        </button>
        <span
          class="min-w-0 flex-1 truncate text-caption"
          :class="task.done ? 'text-widget-ink-mute line-through' : 'text-widget-ink'"
          >{{ titleOf(task) }}</span
        >
        <button
          type="button"
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-control text-widget-ink-mute opacity-0 transition duration-quick group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-widget-fill"
          :aria-label="t('widgets.todos.removeTask')"
          @click="remove(task.id)"
        >
          <OsIcon name="x" :size="12" />
        </button>
      </li>
      <li v-if="rest" class="px-1 text-caption text-widget-ink-mute">
        {{ t('widgets.todos.more', { n: rest }) }}
      </li>
    </ul>

    <form
      v-if="size === 'lg'"
      class="mt-1 flex shrink-0 items-center gap-2 border-t border-widget-line pt-2"
      data-widget-interactive
      @submit.prevent="add"
    >
      <OsIcon name="plus" :size="14" class="shrink-0 text-widget-ink-mute" />
      <input
        v-model="draft"
        type="text"
        class="h-6 min-w-0 flex-1 rounded-chip bg-transparent text-caption text-widget-ink placeholder:text-widget-ink-mute"
        :placeholder="t('widgets.todos.add')"
        :aria-label="t('widgets.todos.addAria')"
      />
    </form>
  </div>
</template>
