<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import { useWidgetContext } from '@/kernel/composables/useWidgetContext'
import { useWidgetStatus } from '@/kernel/composables/useWidgetStatus'
import { useWidgetUpdated } from '@/kernel/composables/useWidgetUpdated'
import { formatSize } from '@/kernel/fs/types'
import type { IconName } from '@/kernel/icons'

interface SimpleBattery {
  level: number
  charging: boolean
}

const { config, size, preview } = useWidgetContext()
const status = useWidgetStatus()
const updated = useWidgetUpdated()
const { t } = useI18n()

const quota = ref<{ usage: number; quota: number } | null>(null)
const battery = ref<SimpleBattery | null>(null)
const online = ref<boolean | null>(typeof navigator.onLine === 'boolean' ? navigator.onLine : null)

function syncOnline() {
  online.value = navigator.onLine === true
}

async function fetchQuota() {
  try {
    const est = await navigator.storage?.estimate?.()
    quota.value = est?.quota ? { usage: est.usage ?? 0, quota: est.quota } : null
  } catch {
    quota.value = null
  }
}

async function fetchBattery() {
  try {
    const bat = await (
      navigator as Navigator & { getBattery?: () => Promise<SimpleBattery> }
    ).getBattery?.()
    battery.value = bat ? { level: bat.level, charging: bat.charging } : null
  } catch {
    battery.value = null
  }
}

async function refresh() {
  await Promise.all([fetchQuota(), fetchBattery()])
  status.markRefreshed()
}

onMounted(() => {
  if (preview) return
  void refresh()
  window.addEventListener('online', syncOnline)
  window.addEventListener('offline', syncOnline)
})

onBeforeUnmount(() => {
  window.removeEventListener('online', syncOnline)
  window.removeEventListener('offline', syncOnline)
})

status.onRefresh(() => void refresh())

interface Cell {
  key: string
  icon?: IconName
  label?: string
  value: string
  detail?: string
  /** 第三档墨色：状态格是答案本身，「更新于」只是它的新鲜度注脚 */
  soft?: boolean
}

const cells = computed<Cell[]>(() => {
  const out: Cell[] = []
  if (online.value !== null) {
    // 两态各写一条 `icon:` 字面量：ternary 里的图标名 `icons:gen` 扫不到，未登记时 OsIcon 静默回落成 file 图标
    out.push(
      online.value
        ? { key: 'network', icon: 'wifi', value: t('widgets.system.online') }
        : { key: 'network', icon: 'wifi-off', value: t('widgets.system.offline') },
    )
  }
  const q = quota.value
  if (q && q.quota > 0) {
    const pct = Math.max(0, Math.min(100, Math.round((q.usage / q.quota) * 100)))
    out.push({
      key: 'storage',
      icon: 'hard-drive',
      label: t('widgets.system.storage'),
      value: t('widgets.storage.ring', { pct }),
      detail: t('widgets.storage.free', { free: formatSize(q.quota - q.usage) }),
    })
  }
  const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (typeof dm === 'number' && dm > 0) {
    out.push({
      key: 'memory',
      icon: 'memory-stick',
      label: t('widgets.system.memory'),
      value: `${dm} GB`,
    })
  }
  const hw = navigator.hardwareConcurrency
  if (typeof hw === 'number' && hw > 0) {
    out.push({
      key: 'cpu',
      icon: 'cpu',
      label: t('widgets.system.cpu'),
      value: t('widgets.system.cores', { n: hw }),
    })
  }
  const bat = battery.value
  if (bat) {
    const pct = Math.round(bat.level * 100)
    // 充电态换字形，状态就不只靠「充电中」这一行字承载（§4.9 双通道）；同样按两态各写一条字面量
    out.push(
      bat.charging
        ? {
            key: 'battery',
            icon: 'battery-charging',
            value: t('widgets.system.battery', { pct }),
            detail: t('widgets.system.charging'),
          }
        : {
            key: 'battery',
            icon: 'battery',
            value: t('widgets.system.battery', { pct }),
            detail: t('widgets.system.onBattery'),
          },
    )
  }
  return out
})

const metric = computed(() => String(config.value.metric ?? 'overview'))

const shown = computed<Cell[]>(() => {
  const base =
    metric.value === 'overview'
      ? size.value === 'sm'
        ? cells.value.slice(0, 2)
        : cells.value
      : cells.value.filter((c) => c.key === metric.value)
  // md 档的内框 126px 被 5 格排满（实测内容包围盒＝内框 100%，再多一行就被 overflow-hidden 裁掉），
  // 所以 A-9 的读数在 md 走**第 6 格**而不是新增一行——三行的行高由最高的那行定，补一个同尺寸的格子不加高度（§4.4 R1）。
  // sm 档只剩约 30px 余量且只画 2 格，读数落在模板里的底部一行。
  if (size.value === 'sm' || !base.length) return base
  return [...base, { key: 'updated', value: updated.value, soft: true }]
})

const gridClass = computed(() => {
  if (size.value === 'sm') {
    return metric.value === 'overview' ? 'grid-cols-1 grid-rows-2' : 'grid-cols-1 grid-rows-1'
  }
  return metric.value === 'overview' ? 'grid-cols-2 auto-rows-fr' : 'grid-cols-1 auto-rows-fr'
})
</script>

<template>
  <div class="h-full flex flex-col">
    <p
      v-if="!shown.length"
      class="flex h-full items-center justify-center text-caption text-widget-ink-mute"
    >
      {{ t('widgets.system.none') }}
    </p>
    <div v-else class="min-h-0 flex-1 grid content-center gap-x-sm gap-y-2xs" :class="gridClass">
      <div
        v-for="cell in shown"
        :key="cell.key"
        :data-widget-cell="cell.key"
        class="flex min-w-0 flex-col justify-center gap-2xs"
        :data-widget-updated="cell.key === 'updated' || undefined"
      >
        <span v-if="cell.label" class="truncate text-caption text-widget-ink-mute">{{
          cell.label
        }}</span>
        <span class="flex min-w-0 items-center gap-2xs">
          <OsIcon
            v-if="cell.icon"
            :name="cell.icon"
            :size="12"
            class="shrink-0 text-widget-ink-mute"
          />
          <span
            class="truncate text-ui tabular-nums"
            :class="cell.soft ? 'text-widget-ink-disabled' : 'font-strong text-widget-ink'"
            >{{ cell.value }}</span
          >
        </span>
        <span
          v-if="cell.detail && size !== 'sm'"
          class="truncate text-caption text-widget-ink-disabled"
          >{{ cell.detail }}</span
        >
      </div>
    </div>

    <!-- sm 档只画 2 格、底部有约 30px 余量：读数走这一行；md 档由上面那第 6 格带（见 shown 的注释） -->
    <p
      v-if="size === 'sm' && shown.length"
      data-widget-updated
      class="shrink-0 pt-2xs text-caption text-widget-ink-disabled"
    >
      {{ updated }}
    </p>
  </div>
</template>
