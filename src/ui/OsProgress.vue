<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import type { ProgressStatus, ProgressType } from './types'

export type { ProgressStatus, ProgressType } from './types'

const props = withDefaults(
  defineProps<{
    /** 进度百分比；内部钳制到 0..100 */
    percent?: number
    type?: ProgressType
    /**
     * 缺省时由 percent 推导：满格即 success——「进度走完」与「成功」在数据上等价，
     * 让调用方手动同步 status 只会多一处漂移源；exception 是旁路失败信号，数据推不出，
     * 必须显式传入。
     */
    status?: ProgressStatus
    /** 描边厚度（px）：line 为轨道厚度，circle 为 SVG 环宽；缺省走刻度档 */
    strokeWidth?: number
    showInfo?: boolean
  }>(),
  { percent: 0, type: 'line', status: undefined, strokeWidth: undefined, showInfo: true },
)

const { t } = useI18n()

const clamped = computed(() => Math.min(100, Math.max(0, props.percent)))
const shown = computed<ProgressStatus>(
  () => props.status ?? (clamped.value >= 100 ? 'success' : 'normal'),
)

/** 条形/环形统一取语义色档：normal 用强调色，success/exception 用状态 seed */
const BAR_CLASS: Record<ProgressStatus, string> = {
  normal: 'bg-accent',
  success: 'bg-success',
  exception: 'bg-danger',
}
const TEXT_CLASS: Record<ProgressStatus, string> = {
  normal: 'text-accent',
  success: 'text-success',
  exception: 'text-danger',
}

// 环形几何：直径取间距刻度 2xl（48px，h-2xl/w-2xl 类），环内数值是 viewBox 相对单位；
// strokeWidth 若提供则两种形态都换算为 px 内联值（几何参数而非视觉裸值）
const RING_SW = computed(() => props.strokeWidth ?? 6)
const RING_R = computed(() => 24 - RING_SW.value / 2)
const CIRCUMFERENCE = 2 * Math.PI * 24
const ringDash = computed(() => `${(clamped.value / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`)
const trackStyle = computed(() =>
  props.strokeWidth !== undefined ? { height: `${props.strokeWidth}px` } : undefined,
)
const barStyle = computed(() =>
  props.strokeWidth !== undefined
    ? { width: `${clamped.value}%`, height: `${props.strokeWidth}px` }
    : { width: `${clamped.value}%` },
)
</script>

<template>
  <div
    v-if="type === 'line'"
    role="progressbar"
    :aria-label="t('progress.aria')"
    :aria-valuenow="clamped"
    aria-valuemin="0"
    aria-valuemax="100"
    class="flex items-center gap-xs text-caption"
  >
    <div
      class="h-2xs min-w-0 flex-1 overflow-hidden rounded-full bg-fill-secondary"
      :style="trackStyle"
    >
      <div
        class="h-full rounded-full transition-[width] duration-base ease-out"
        :class="BAR_CLASS[shown]"
        :style="barStyle"
      />
    </div>
    <span v-if="showInfo" class="shrink-0 tabular-nums" :class="TEXT_CLASS[shown]">
      {{ clamped }}%
    </span>
  </div>

  <div
    v-else
    role="progressbar"
    :aria-label="t('progress.aria')"
    :aria-valuenow="clamped"
    aria-valuemin="0"
    aria-valuemax="100"
    class="relative inline-flex h-2xl w-2xl items-center justify-center"
  >
    <svg class="h-full w-full -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
      <circle
        class="text-fill-secondary"
        fill="none"
        stroke="currentColor"
        :stroke-width="RING_SW"
        cx="24"
        cy="24"
        :r="RING_R"
      />
      <circle
        :class="[TEXT_CLASS[shown], 'transition-all duration-base ease-out']"
        fill="none"
        stroke="currentColor"
        :stroke-width="RING_SW"
        :stroke-dasharray="ringDash"
        stroke-linecap="round"
        cx="24"
        cy="24"
        :r="RING_R"
      />
    </svg>
    <span
      v-if="showInfo"
      class="absolute inset-0 flex items-center justify-center text-caption font-strong"
      :class="TEXT_CLASS[shown]"
    >
      <OsIcon v-if="shown === 'success'" name="check" :size="14" />
      <template v-else>{{ clamped }}%</template>
    </span>
  </div>
</template>
