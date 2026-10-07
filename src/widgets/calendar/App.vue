<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import { useWidgetContext } from '@/kernel/composables/useWidgetContext'
import { useWidgetDrill } from '@/kernel/composables/useWidgetDrill'
import { useWidgetTick, TICK_HALF_MINUTE } from '@/kernel/composables/useWidgetTick'
import { useWidgetData } from '@/kernel/composables/useWidgetData'
import {
  EVENTS_KEY,
  displayTitle,
  emptyEvents,
  normalizeEvents,
  sampleEvents,
  toIsoDay,
  type EventFile,
  type ScheduleEvent,
} from '@/kernel/widget/taskSchedule'

/**
 * 月历（批次 A）：主结论「这个月、今天是什么日子」。
 * md 给整月网格（阅读面），lg 才在下面接今天的日程、并把日格做成可点——同一档不重复表达同一件事（R2）。
 * 行高用 `minmax(0,1fr)` 由格子自己分，不写死 px：月视图有 4/5/6 行三种形态，写死必溢出。
 */
const { locale, t, te } = useI18n()
const { size, config, setSelected, preview } = useWidgetContext()
const { target, open } = useWidgetDrill()

const beat = useWidgetTick(TICK_HALF_MINUTE)
// 预览沙箱里读不到真文件，样例由件自带（§4.8 屏蔽 1）；日期锚在今天，否则「今天」筛选会滤空
const file = useWidgetData<EventFile>(EVENTS_KEY, () => (preview ? sampleEvents() : emptyEvents()))
const events = computed(() => normalizeEvents(file.data.value).events)

const today = computed(() => new Date(beat.value))
const todayIso = computed(() => toIsoDay(today.value))

/** 英文界面周日起、中文界面周一起；`auto` 之外一律尊重用户选择 */
const weekStart = computed(() => {
  const value = String(config.value.weekStart ?? 'auto')
  if (value === 'monday') return 1
  if (value === 'sunday') return 0
  return String(locale.value).toLowerCase().startsWith('en') ? 0 : 1
})

const monthOffset = ref(0)
watch(todayIso, () => (monthOffset.value = 0))

const anchor = computed(
  () => new Date(today.value.getFullYear(), today.value.getMonth() + monthOffset.value, 1),
)
const monthTitle = computed(() =>
  new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' }).format(anchor.value),
)

const weekdayLabels = computed(() => {
  const fmt = new Intl.DateTimeFormat(locale.value, { weekday: 'short' })
  const base = new Date(2024, 0, 7) // 2024-01-07 是周日，从这里推任意起始日都准
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + ((i + weekStart.value) % 7))
    return fmt.format(d)
  })
})

interface DayCell {
  iso: string
  day: number
  inMonth: boolean
  isToday: boolean
  hasEvent: boolean
}

const eventDays = computed(() => new Set(events.value.map((e) => e.date)))

const cells = computed<DayCell[]>(() => {
  const year = anchor.value.getFullYear()
  const month = anchor.value.getMonth()
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const lead = (first.getDay() - weekStart.value + 7) % 7
  const out: DayCell[] = []
  const push = (d: Date, inMonth: boolean) => {
    const iso = toIsoDay(d)
    out.push({
      iso,
      day: d.getDate(),
      inMonth,
      isToday: iso === todayIso.value,
      hasEvent: eventDays.value.has(iso),
    })
  }
  for (let i = lead - 1; i >= 0; i--) push(new Date(year, month, -i), false)
  for (let d = 1; d <= daysInMonth; d++) push(new Date(year, month, d), true)
  while (out.length % 7) {
    const last = new Date(out[out.length - 1].iso + 'T00:00:00')
    last.setDate(last.getDate() + 1)
    push(last, false)
  }
  return out
})

const rowCount = computed(() => Math.ceil(cells.value.length / 7))
/** 7 列模板必须逐格写进 inline style：类名里的 grid 只给 display:grid，列数是隐式的 1 列 */
const headerGrid = { gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }
const bodyGrid = computed(() => ({
  ...headerGrid,
  gridTemplateRows: `repeat(${rowCount.value}, minmax(0, 1fr))`,
}))

const selectedIso = ref<string | null>(null)
const shownIso = computed(() => selectedIso.value ?? todayIso.value)

/**
 * 命中区地板（R4：≥24×24）优先于档位交互清单：md 内框 126px 减去标题行与星期表头后，
 * 6 行月网格每格只剩 13px，而 6×24=144px 根本放不进去——两者互斥时降级的是**交互**，不是内容。
 * 所以 md 的网格是阅读面（整月照样看得清），点选日期是 lg 才给的能力，标题行的下钻两档都在。
 */
const pickable = computed(() => size.value === 'lg')

function pickDay(cell: DayCell) {
  if (!pickable.value || !cell.inMonth) return
  selectedIso.value = cell.iso
  setSelected(cell.iso)
}

const agenda = computed<ScheduleEvent[]>(() => {
  const list = events.value.filter((e) => e.date === todayIso.value)
  return list.sort((a, b) => (a.start ?? '99:99').localeCompare(b.start ?? '99:99'))
})
/**
 * 议程给 6 行的月份让出一行。lg 内框 320px（344 − 2 边框 − 22 内衬）里标题行 29 +
 * 星期表头 18 + 根间隙 12 是固定的，议程满（3 条 +「还有 N 项」）要吃掉 115px，
 * 剩下的 146px 摊给 6 行网格 ⇒ 每格 21px，撞上 R4 的 24×24 命中区地板（实测读数见
 * `tests/e2e/widget-acceptance.spec.ts` 的 T4 最差形态腿）。按偏差 14 的裁决——地板优先，
 * 让位的是内容不是地板——6 行月只排 2 条，余下的走 agendaRest 计数出口（R3），网格回到 24.7px。
 */
const agendaMax = computed(() => (rowCount.value >= 6 ? 2 : 3))
const agendaShown = computed(() => agenda.value.slice(0, agendaMax.value))
const agendaRest = computed(() => Math.max(0, agenda.value.length - agendaShown.value.length))

function eventTitle(event: ScheduleEvent): string {
  return displayTitle(event, {
    preview,
    label: (key) => (te(key) ? t(key) : undefined),
  })
}

/** 农历只在中文界面给：拿不到就整项不渲染，不画「—」（§4.9 降级硬要求） */
const lunar = computed(() => {
  if (!String(locale.value).toLowerCase().startsWith('zh')) return ''
  try {
    return new Intl.DateTimeFormat('zh-CN-u-ca-chinese', { day: 'numeric', month: 'long' }).format(
      new Date(shownIso.value + 'T00:00:00'),
    )
  } catch {
    return ''
  }
})

const dayLabel = computed(() =>
  new Intl.DateTimeFormat(locale.value, { month: 'long', day: 'numeric' }).format(
    new Date(shownIso.value + 'T00:00:00'),
  ),
)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-1">
    <!-- 卡片内部结构一律不用 header/footer：它们在无障碍树里是 landmark，
         桌面件是 role="group" 的卡片，不该往「跳转地标」里塞第三、第四个 banner -->
    <div class="flex shrink-0 items-center justify-between gap-2">
      <!-- 标题行是两档都在的下钻入口（§4.5）；lg 另外还认「点日期选」，md 的日格不够大（见 pickable） -->
      <button
        type="button"
        class="flex min-w-0 items-baseline gap-2 rounded-control px-1 py-2xs text-left transition duration-quick hover:bg-widget-fill"
        :disabled="!target"
        :aria-label="t('widgets.openApp')"
        @click="open"
      >
        <span class="truncate text-title text-widget-ink">{{ monthTitle }}</span>
        <span v-if="size === 'lg'" class="shrink-0 text-caption text-widget-ink-mute">
          {{ dayLabel }}
        </span>
      </button>

      <div class="flex shrink-0 items-center gap-1">
        <button
          type="button"
          class="flex h-6 w-6 items-center justify-center rounded-control text-widget-ink-mute transition duration-quick hover:bg-widget-fill hover:text-widget-ink"
          :aria-label="t('widgets.calendar.prevMonth')"
          @click="monthOffset -= 1"
        >
          <OsIcon name="chevron-left" :size="14" />
        </button>
        <button
          type="button"
          class="flex h-6 w-6 items-center justify-center rounded-control text-widget-ink-mute transition duration-quick hover:bg-widget-fill hover:text-widget-ink"
          :aria-label="t('widgets.calendar.nextMonth')"
          @click="monthOffset += 1"
        >
          <OsIcon name="chevron-right" :size="14" />
        </button>
      </div>
    </div>

    <div class="grid shrink-0 gap-1" :style="headerGrid">
      <span
        v-for="label in weekdayLabels"
        :key="label"
        class="truncate text-center text-caption text-widget-ink-mute"
        >{{ label }}</span
      >
    </div>

    <div class="grid min-h-0 flex-1 gap-1" :style="bodyGrid">
      <div
        v-for="cell in cells"
        :key="cell.iso"
        class="flex min-h-0 flex-col items-center justify-center rounded-control"
        :class="[
          cell.inMonth ? 'text-widget-ink' : 'text-widget-ink-disabled',
          cell.iso === shownIso && cell.inMonth ? 'bg-widget-fill' : '',
          cell.isToday && cell.iso !== shownIso ? 'border border-widget-line' : '',
        ]"
      >
        <!-- 可点的档是 button、只读的档是 div：命中区地板不达标时不把 13px 的格子做成按钮 -->
        <component
          :is="pickable && cell.inMonth ? 'button' : 'div'"
          :type="pickable && cell.inMonth ? 'button' : undefined"
          class="flex h-full w-full flex-col items-center justify-center gap-0.5 text-caption"
          :class="cell.isToday && cell.inMonth ? 'font-strong text-primary' : ''"
          :aria-label="
            pickable && cell.inMonth ? t('widgets.calendar.pickDay', { day: cell.day }) : undefined
          "
          :aria-pressed="pickable && cell.inMonth ? cell.iso === shownIso : undefined"
          @click="pickDay(cell)"
        >
          <span class="tabular-nums leading-none">{{ cell.day }}</span>
          <!-- 有日程给点状标记：形状通道，不靠颜色独裁（H-3） -->
          <span
            v-if="cell.hasEvent && cell.inMonth"
            class="h-1 w-1 rounded-full bg-widget-ink-mute"
            aria-hidden="true"
          ></span>
        </component>
      </div>
    </div>

    <div
      v-if="size === 'lg' && config.showAgenda !== false"
      class="mt-auto shrink-0 border-t border-widget-line pt-2"
    >
      <template v-if="agenda.length">
        <p class="text-caption text-widget-ink-mute">
          {{ t('widgets.calendar.agenda', { n: agenda.length }) }}
        </p>
        <ul class="mt-1 flex flex-col gap-1">
          <li
            v-for="event in agendaShown"
            :key="event.id"
            class="flex min-w-0 items-baseline gap-2 text-caption"
          >
            <span class="shrink-0 tabular-nums text-widget-ink-mute">{{ event.start ?? '·' }}</span>
            <span class="truncate text-widget-ink">{{ eventTitle(event) }}</span>
          </li>
        </ul>
        <p v-if="agendaRest" class="mt-1 text-caption text-widget-ink-mute">
          {{ t('widgets.calendar.more', { n: agendaRest }) }}
        </p>
      </template>
      <p v-else-if="lunar" class="text-caption text-widget-ink-mute">
        {{ t('widgets.calendar.lunar', { value: lunar }) }}
      </p>
      <p v-else class="text-caption text-widget-ink-mute">{{ t('widgets.calendar.noAgenda') }}</p>
    </div>
  </div>
</template>
