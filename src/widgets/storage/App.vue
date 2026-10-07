<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWidgetContext } from '@/kernel/composables/useWidgetContext'
import { useWidgetStatus } from '@/kernel/composables/useWidgetStatus'
import { useWidgetUpdated } from '@/kernel/composables/useWidgetUpdated'
import { useVfs } from '@/kernel/stores/vfs'
import { formatSize, isUnderTrash, TRASH_ROOT } from '@/kernel/fs/types'

const { config, size, preview, setSelected } = useWidgetContext()
const status = useWidgetStatus()
const updated = useWidgetUpdated()
const vfs = useVfs()
const { t } = useI18n()

interface Quota {
  usage: number
  quota: number
}

const quota = ref<Quota | null>(null)
const quotaRead = ref(false)

async function fetchEstimate() {
  try {
    const est = await navigator.storage?.estimate?.()
    quota.value = est?.quota ? { usage: est.usage ?? 0, quota: est.quota } : null
  } catch {
    quota.value = null
  }
  quotaRead.value = true
  status.markRefreshed()
}

/** 沙箱样例：与 system 同一口径——异步浏览器读只在真实例上做，但预览得把形态画出来 */
const SAMPLE_QUOTA: Quota = { usage: 148 * 1024 ** 3, quota: 512 * 1024 ** 3 }

onMounted(() => {
  if (preview) {
    // sm 档只有环与百分比两样东西：不喂样例就是拍一张白卡
    quota.value = SAMPLE_QUOTA
    quotaRead.value = true
    return
  }
  void fetchEstimate()
})
status.onRefresh(() => void fetchEstimate())

const usedPct = computed(() => {
  const q = quota.value
  if (!q || q.quota <= 0) return null
  return Math.max(0, Math.min(100, Math.round((q.usage / q.quota) * 100)))
})

const stats = computed(() => {
  let filesSize = 0
  let trashSize = 0
  let filesCount = 0
  let trashCount = 0
  for (const node of Object.values(vfs.nodes)) {
    if (node.type !== 'file') continue
    if (isUnderTrash(node.path)) {
      trashSize += node.size
      trashCount += 1
    } else {
      filesSize += node.size
      filesCount += 1
    }
  }
  return { filesSize, trashSize, filesCount, trashCount }
})

watchEffect(() => {
  if (preview) return
  setSelected({ path: stats.value.trashSize > stats.value.filesSize ? TRASH_ROOT : '/我的文件' })
})

const RING_C = 2 * Math.PI * 26

const ringSizeClass = computed(() => (size.value === 'sm' ? 'h-14 w-14' : 'h-12 w-12'))

function dashOffset(pct: number): number {
  return RING_C * (1 - pct / 100)
}

function barWidth(value: number): string {
  const max = Math.max(stats.value.filesSize, stats.value.trashSize, 1)
  return `${Math.round((value / max) * 100)}%`
}

const unitIsBytes = computed(() => config.value.unit === 'bytes')

const captionLine = computed(() => {
  const q = quota.value
  const pct = usedPct.value
  if (q && pct !== null) {
    return unitIsBytes.value
      ? t('widgets.storage.free', { free: formatSize(q.quota - q.usage) })
      : t('widgets.storage.ring', { pct })
  }
  return ''
})
</script>

<template>
  <div
    v-if="usedPct === null && size === 'sm'"
    class="h-full flex flex-col items-center justify-center"
  >
    <p v-if="quotaRead" class="text-caption text-widget-ink-mute">
      {{ t('widgets.storage.unavailable') }}
    </p>
  </div>

  <div v-else class="h-full flex items-center justify-center gap-sm">
    <div v-if="usedPct !== null" class="relative shrink-0" :class="ringSizeClass">
      <svg viewBox="0 0 64 64" class="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r="26" fill="none" stroke-width="6" class="stroke-widget-line" />
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="none"
          stroke-width="6"
          stroke-linecap="round"
          class="stroke-widget-ink transition duration-base"
          :stroke-dasharray="RING_C"
          :stroke-dashoffset="dashOffset(usedPct)"
        />
      </svg>
      <span
        class="absolute inset-0 flex items-center justify-center text-title font-strong tabular-nums text-widget-ink"
      >
        {{ usedPct }}%
      </span>
    </div>

    <div v-if="size === 'sm'" class="flex flex-col items-start gap-2xs">
      <p class="text-caption text-widget-ink-mute">{{ captionLine }}</p>
      <p data-widget-updated class="text-caption text-widget-ink-disabled">{{ updated }}</p>
    </div>

    <div v-else class="min-w-0 flex-1 flex flex-col justify-center gap-xs">
      <div class="flex items-center gap-xs">
        <span class="shrink-0 text-caption text-widget-ink-mute">{{
          t('widgets.storage.files')
        }}</span>
        <span class="h-1 min-w-0 flex-1 overflow-hidden rounded-chip bg-widget-fill">
          <span
            class="block h-full rounded-chip bg-current text-widget-ink"
            :style="{ width: barWidth(stats.filesSize) }"
          />
        </span>
        <span class="shrink-0 text-caption font-strong tabular-nums text-widget-ink">
          {{ formatSize(stats.filesSize) }}
        </span>
      </div>
      <div class="flex items-center gap-xs">
        <span class="shrink-0 text-caption text-widget-ink-mute">{{
          t('widgets.storage.trash')
        }}</span>
        <span class="h-1 min-w-0 flex-1 overflow-hidden rounded-chip bg-widget-fill">
          <span
            class="block h-full rounded-chip bg-current text-widget-ink"
            :style="{ width: barWidth(stats.trashSize) }"
          />
        </span>
        <span class="shrink-0 text-caption font-strong tabular-nums text-widget-ink">
          {{ formatSize(stats.trashSize) }}
        </span>
      </div>
      <p class="text-caption text-widget-ink-mute">
        {{ t('widgets.storage.count', { n: stats.filesCount + stats.trashCount }) }}
        <span v-if="captionLine" class="text-widget-ink-disabled">· {{ captionLine }}</span>
      </p>
      <p data-widget-updated class="text-caption text-widget-ink-disabled">{{ updated }}</p>
    </div>
  </div>
</template>
