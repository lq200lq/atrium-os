<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import { useOS } from '@/kernel/composables/useOS'
import { isUnderTrash } from '@/kernel/fs/types'
import { fileIconClass, fileIconName, type IconName } from '@/kernel/icons'
import { useAppRegistry } from '@/kernel/stores/appRegistry'
import { useShellUi } from '@/kernel/stores/shellUi'
import { useVfs } from '@/kernel/stores/vfs'
import { useAppName } from '@/i18n'

type Hit = {
  kind: 'app' | 'file'
  label: string
  sub: string
  icon: IconName
  iconCls?: string
  run: () => void
}

const ui = useShellUi()
const os = useOS()
const registry = useAppRegistry()
const vfs = useVfs()
const { t } = useI18n()
const appName = useAppName()

const query = ref('')
const cursor = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)

const hits = computed<Hit[]>(() => {
  const q = query.value.trim().toLowerCase()
  const out: Hit[] = []

  for (const app of registry.accessibleApps) {
    const label = appName(app)
    const hay = [app.id, app.name, label, ...(app.keywords ?? [])].join(' ').toLowerCase()
    if (!q || hay.includes(q)) {
      out.push({
        kind: 'app',
        label,
        sub: `${t('spotlight.appKind')} · ${app.id}`,
        icon: app.icon,
        run: () => os.open(app.id),
      })
    }
  }

  for (const node of Object.values(vfs.nodes)) {
    if (node.type !== 'file' || isUnderTrash(node.path)) continue
    if (q && !node.name.toLowerCase().includes(q)) continue
    out.push({
      kind: 'file',
      label: node.name,
      sub: node.path,
      icon: fileIconName(node),
      iconCls: fileIconClass(node),
      run: () => os.exec('doc-editor:open', { key: node.path, path: node.path }),
    })
  }

  return out.slice(0, 12)
})

watch(
  () => ui.spotlightOpen,
  (open) => {
    if (open) {
      query.value = ''
      cursor.value = 0
      void nextTick(() => inputEl.value?.focus())
    }
  },
)

watch(hits, (h) => {
  if (cursor.value >= h.length) cursor.value = 0
})

function pick(hit?: Hit) {
  const target = hit ?? hits.value[cursor.value]
  if (!target) return
  target.run()
  ui.closeOverlays()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    ui.closeOverlays()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    cursor.value = (cursor.value + 1) % Math.max(1, hits.value.length)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    cursor.value = (cursor.value - 1 + hits.value.length) % Math.max(1, hits.value.length)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    pick()
  }
}
</script>

<template>
  <div
    v-if="ui.spotlightOpen"
    class="fixed inset-0 z-overlay flex items-start justify-center bg-scrim pt-28 backdrop-blur-sm"
    @pointerdown.self="ui.closeOverlays()"
  >
    <div
      class="w-[520px] max-w-[92vw] overflow-hidden rounded-panel border border-glass-border-active bg-glass-pop shadow-pop"
    >
      <div class="flex items-center gap-2 border-b border-line px-4 py-3">
        <OsIcon name="search" :size="16" class="text-ink-mute" />
        <input
          ref="inputEl"
          v-model="query"
          class="flex-1 bg-transparent text-title text-ink placeholder:text-ink-mute"
          :placeholder="t('spotlight.placeholder')"
          @keydown="onKey"
        />
        <span class="text-caption text-ink-mute">esc</span>
      </div>
      <ul class="max-h-[320px] overflow-y-auto py-1">
        <li v-for="(h, i) in hits" :key="h.kind + h.sub">
          <button
            class="flex w-full items-center gap-3 px-4 py-2 text-left"
            :class="i === cursor ? 'bg-accent-soft' : 'hover:bg-surface-hover'"
            @mouseenter="cursor = i"
            @click="pick(h)"
          >
            <OsIcon :name="h.icon" :size="18" :class="h.iconCls" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-ui font-strong text-ink">{{ h.label }}</span>
              <span class="block truncate text-caption text-ink-mute">{{ h.sub }}</span>
            </span>
          </button>
        </li>
        <li v-if="hits.length === 0" class="px-4 py-8 text-center text-ui text-ink-mute">
          {{ t('spotlight.noResult') }}
        </li>
      </ul>
    </div>
  </div>
</template>
