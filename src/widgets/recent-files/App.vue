<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import { useOS } from '@/kernel/composables/useOS'
import { useWidgetContext } from '@/kernel/composables/useWidgetContext'
import { TICK_MINUTE, useWidgetTick } from '@/kernel/composables/useWidgetTick'
import { fileIconName } from '@/kernel/icons'
import { relativeTimeLabel } from '@/kernel/relativeTime'
import { useVfs } from '@/kernel/stores/vfs'
import { isUnderTrash, type FsNode } from '@/kernel/fs/types'
import { DATA_ROOT } from '@/kernel/widget/widgetData'

const { config, size, preview, setSelected } = useWidgetContext()
const vfs = useVfs()
const os = useOS()
const { t, locale } = useI18n()
const now = useWidgetTick(TICK_MINUTE)

const limit = computed(() => {
  const raw = Number(config.value.count)
  const n = Number.isFinite(raw) ? Math.min(8, Math.max(4, Math.round(raw))) : 8
  return size.value === 'md' ? Math.min(n, 4) : n
})

// 「我的数据」是应用级内部状态而非用户文档，别让它盖掉「最近在编辑什么」
const recent = computed<FsNode[]>(() =>
  Object.values(vfs.nodes)
    .filter(
      (n) => n.type === 'file' && !isUnderTrash(n.path) && !n.path.startsWith(`${DATA_ROOT}/`),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit.value),
)

watchEffect(() => {
  if (preview) return
  const top = recent.value[0]
  if (top) setSelected(top.path)
})

function relTime(ts: number): string {
  return relativeTimeLabel(ts, now.value, locale.value)
}

function openNode(node: FsNode) {
  if (preview) return
  setSelected(node.path)
  os.open('file-manager', { path: node.path })
}
</script>

<template>
  <div class="h-full flex min-h-0 flex-col gap-2xs">
    <p
      v-if="!recent.length"
      class="flex h-full items-center justify-center text-caption text-widget-ink-mute"
    >
      {{ t('widgets.recentFiles.empty') }}
    </p>
    <button
      v-for="node in recent"
      :key="node.path"
      type="button"
      class="flex min-h-6 flex-1 items-center gap-xs rounded-chip px-2xs text-left transition duration-quick hover:bg-widget-fill"
      @click="openNode(node)"
    >
      <OsIcon :name="fileIconName(node)" :size="14" class="shrink-0 text-widget-ink-mute" />
      <span class="min-w-0 flex-1 truncate text-ui text-widget-ink">{{ node.name }}</span>
      <span class="shrink-0 text-caption tabular-nums text-widget-ink-mute">{{
        relTime(node.updatedAt)
      }}</span>
    </button>
  </div>
</template>
