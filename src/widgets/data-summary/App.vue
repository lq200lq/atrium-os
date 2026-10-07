<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import { DEPTS, SEED } from '@/kernel/data/orgSeed'
import { useWidgetContext, WIDGET_PREVIEW_KEY } from '@/kernel/composables/useWidgetContext'
import { useWidgetStatus } from '@/kernel/composables/useWidgetStatus'
import { useWidgetUpdated } from '@/kernel/composables/useWidgetUpdated'

/**
 * 数据摘要（§4.9 批次 C）：数据看板 fixture 的关键指标 + 迷你趋势，只读展示型。
 * 数据源 `kernel/data/orgSeed` 是纯数据模块：看板与件共用一份 fixture，件不跨线 import 应用。
 * 预览沙箱按 useWidgetData 同法取件自带样例（本件无 manifest.data ⇒ 键落 kind id）。
 */
const { manifest, preview, kindId } = useWidgetContext()
const status = useWidgetStatus()
const updated = useWidgetUpdated()
const { t } = useI18n()

interface Metric {
  total: number
  deptCount: number
  /** 各在职年份的新增人数（升序），只留有数的年份 */
  trend: { year: number; count: number }[]
}

const sample = inject(WIDGET_PREVIEW_KEY, null)?.sample?.[kindId.value] as
  Partial<Metric> | undefined

const fromSeed = (): Metric => {
  const hires = new Map<number, number>()
  for (const row of SEED) {
    const year = Number(String(row.joinedAt).slice(0, 4))
    if (Number.isFinite(year)) hires.set(year, (hires.get(year) ?? 0) + 1)
  }
  return {
    total: SEED.length,
    deptCount: DEPTS.length,
    trend: [...hires.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, count]) => ({ year, count })),
  }
}

const metric = computed<Metric | null>(() => {
  if (preview) {
    if (!sample || typeof sample.total !== 'number' || sample.total <= 0) return null
    return {
      total: sample.total,
      deptCount: typeof sample.deptCount === 'number' ? sample.deptCount : 0,
      trend: Array.isArray(sample.trend) ? sample.trend.filter((p) => p && p.count > 0) : [],
    }
  }
  const m = fromSeed()
  return m.total > 0 ? m : null
})

/** 迷你趋势：字符块条（text 通道，不靠颜色），归一到 5 档高度 */
const GLYPHS = ['▁', '▂', '▄', '▆', '█']
const sparkline = computed(() => {
  const trend = metric.value?.trend ?? []
  if (!trend.length) return ''
  const max = Math.max(...trend.map((p) => p.count))
  return trend
    .map(
      (p) => GLYPHS[Math.min(GLYPHS.length - 1, Math.round((p.count / max) * (GLYPHS.length - 1)))],
    )
    .join('')
})

const lastYear = computed(() => {
  const trend = metric.value?.trend ?? []
  const last = trend[trend.length - 1]
  return last ? `${last.year} +${last.count}` : ''
})

const name = computed(() => t(manifest.value?.nameKey ?? 'widgets.names.data-summary'))

/** 取数节奏＝静态 fixture + 宿主 refresh 信号；件不轮询、不自持定时器 */
status.markRefreshed()
status.onRefresh(() => status.markRefreshed())
</script>

<template>
  <div class="flex h-full flex-col gap-2xs">
    <div class="flex h-6 items-center gap-2xs">
      <OsIcon name="activity" :size="12" class="shrink-0" />
      <span class="min-w-0 flex-1 truncate text-caption font-strong">{{ name }}</span>
      <!-- 单档件（md）的内框被指标行 + 趋势行排满，A-9 的读数走标题行右端：不加行就不越框（§4.4 R1） -->
      <span data-widget-updated class="shrink-0 text-caption text-widget-ink-disabled">{{
        updated
      }}</span>
    </div>

    <!-- 拿不到的数据整项不渲染：指标为空时只剩空态，不留 NaN/undefined -->
    <template v-if="metric">
      <div class="flex min-h-0 flex-1 items-end gap-lg">
        <div class="flex flex-col">
          <p class="text-heading-1 font-strong">{{ metric.total }}</p>
          <p class="text-caption text-widget-ink-mute">{{ t('widgets.dataSummary.headcount') }}</p>
        </div>
        <div v-if="metric.deptCount > 0" class="flex flex-col">
          <p class="text-heading-2 font-strong">{{ metric.deptCount }}</p>
          <p class="text-caption text-widget-ink-mute">
            {{ t('widgets.dataSummary.departments') }}
          </p>
        </div>
      </div>
      <div v-if="sparkline" class="flex items-center gap-2xs">
        <p class="shrink-0 text-caption text-widget-ink-mute">
          {{ t('widgets.dataSummary.trend') }}
        </p>
        <p class="text-widget-ink">{{ sparkline }}</p>
        <p v-if="lastYear" class="text-caption text-widget-ink-mute">{{ lastYear }}</p>
      </div>
    </template>
    <p v-else class="flex min-h-0 flex-1 items-center text-caption text-widget-ink-disabled">
      {{ t('widgets.dataSummary.empty') }}
    </p>
  </div>
</template>
