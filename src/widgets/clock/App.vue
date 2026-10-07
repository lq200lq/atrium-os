<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWidgetContext } from '@/kernel/composables/useWidgetContext'
import { useWidgetTick, TICK_SECOND } from '@/kernel/composables/useWidgetTick'
import { ianaOf, isDayIn } from './zones'

/**
 * 时钟（批次 A）：主结论「现在几点」。
 * 内容预算按档递增且不重复表达同一件事（R1）——sm 只有时间，md 加日期，lg 才给第二时区。
 * 心跳走宿主共享调度器，件内不自持 setInterval（K2）。
 */
const { locale, t } = useI18n()
const { config, size } = useWidgetContext()

const beat = useWidgetTick(TICK_SECOND)
const now = computed(() => new Date(beat.value))

const hour12 = computed(() => config.value.hour12 === true)
const seconds = computed(() => config.value.seconds === true && size.value !== 'sm')
const secondTz = computed(() => ianaOf(config.value.secondTz))

function format(withZone: string | undefined, withSeconds: boolean): string {
  return now.value.toLocaleTimeString(locale.value, {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    hour12: hour12.value,
    ...(withZone ? { timeZone: withZone } : {}),
  })
}

const time = computed(() => format(undefined, seconds.value))
const dateLine = computed(() =>
  now.value.toLocaleDateString(locale.value, { month: 'long', day: 'numeric', weekday: 'long' }),
)
const secondTime = computed(() => (secondTz.value ? format(secondTz.value, false) : ''))
const secondLabel = computed(() => {
  const key = String(config.value.secondTz ?? 'local')
  return t(`widgets.configOptions.tz.${key}`)
})
const dayNight = computed(() =>
  secondTz.value
    ? t(isDayIn(config.value.secondTz, now.value) ? 'widgets.clock.day' : 'widgets.clock.night')
    : '',
)

const timeClass = computed(() => (size.value === 'lg' ? 'text-display-1' : 'text-display-2'))
</script>

<template>
  <div class="flex h-full flex-col justify-center gap-1">
    <p class="font-regular tabular-nums text-widget-ink" :class="timeClass">{{ time }}</p>
    <p v-if="size !== 'sm'" class="text-caption text-widget-ink-mute">{{ dateLine }}</p>

    <div
      v-if="size === 'lg' && secondTz"
      class="mt-2 flex items-baseline justify-between border-t border-widget-line pt-2"
    >
      <div class="flex min-w-0 flex-col">
        <span class="truncate text-caption text-widget-ink-mute">{{ secondLabel }}</span>
        <!-- 白天/夜间给文字不给颜色独裁（H-3） -->
        <span class="text-caption text-widget-ink-mute">{{ dayNight }}</span>
      </div>
      <span class="shrink-0 tabular-nums text-title text-widget-ink">{{ secondTime }}</span>
    </div>
  </div>
</template>
