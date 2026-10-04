<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import OsIcon from '@/components/OsIcon.vue'
import { useOS } from '@/kernel/composables/useOS'
import { isUnderTrash } from '@/kernel/fs/types'
import { fileIconClass, fileIconName, type IconName } from '@/kernel/icons'
import { useAppRegistry } from '@/kernel/stores/appRegistry'
import { useShellUi } from '@/kernel/stores/shellUi'
import { useVfs } from '@/kernel/stores/vfs'

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

const query = ref('')
const cursor = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)

const hits = computed<Hit[]>(() => {
  const q = query.value.trim().toLowerCase()
  const out: Hit[] = []

  for (const app of registry.accessibleApps) {
    const hay = [app.id, app.name, ...(app.keywords ?? [])].join(' ').toLowerCase()
    if (!q || hay.includes(q)) {
      out.push({
        kind: 'app',
        label: app.name,
        sub: `应用 · ${app.id}`,
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
    class="fixed inset-0 z-[9997] flex items-start justify-center bg-black/20 pt-28 backdrop-blur-sm"
    @pointerdown.self="ui.closeOverlays()"
  >
    <div
      class="w-[520px] max-w-[92vw] overflow-hidden rounded-2xl border border-glass-border-active bg-glass-pop shadow-pop"
    >
      <div class="flex items-center gap-2 border-b border-slate-200/70 px-4 py-3">
        <OsIcon name="search" :size="16" class="text-ink-mute" />
        <input
          ref="inputEl"
          v-model="query"
          class="flex-1 bg-transparent text-title text-ink outline-none placeholder:text-ink-mute"
          placeholder="搜索应用与文件…"
          @keydown="onKey"
        />
        <span class="text-caption text-ink-mute">esc</span>
      </div>
      <ul class="max-h-[320px] overflow-y-auto py-1">
        <li v-for="(h, i) in hits" :key="h.kind + h.sub">
          <button
            class="flex w-full items-center gap-3 px-4 py-2 text-left"
            :class="i === cursor ? 'bg-accent-soft' : 'hover:bg-slate-50'"
            @mouseenter="cursor = i"
            @click="pick(h)"
          >
            <OsIcon :name="h.icon" :size="18" :class="h.iconCls" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-ui font-medium text-ink">{{ h.label }}</span>
              <span class="block truncate text-caption text-ink-mute">{{ h.sub }}</span>
            </span>
          </button>
        </li>
        <li v-if="hits.length === 0" class="px-4 py-8 text-center text-ui text-ink-mute">
          无匹配结果
        </li>
      </ul>
    </div>
  </div>
</template>
