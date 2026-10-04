<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import OsIcon from '@/components/OsIcon.vue'
import { useOS } from '@/kernel/composables/useOS'
import { useWindowContext } from '@/kernel/composables/useWindowContext'
import type { VfsChangeEvent } from '@/kernel/fs/types'
import { useVfs } from '@/kernel/stores/vfs'
import { useWindowManager } from '@/kernel/stores/windowManager'

const { winId, win } = useWindowContext()
const vfs = useVfs()
const wm = useWindowManager()
const os = useOS()

const path = computed(() => (win.value.payload as { path?: string } | undefined)?.path)
const node = computed(() => (path.value ? vfs.byPath(path.value) : undefined))
const missing = computed(() => !!path.value && !node.value)

const content = ref(node.value?.content ?? '')
const savedAt = ref<string | null>(null)
let timer: number | undefined

watch(
  path,
  (p) => {
    content.value = (p && vfs.byPath(p)?.content) ?? ''
    savedAt.value = null
  },
  { immediate: true },
)
watch(
  node,
  (n) => {
    if (n) wm.setTitle(winId, n.name)
  },
  { immediate: true },
)

function onInput() {
  savedAt.value = null
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    const p = path.value
    if (p && vfs.byPath(p)) {
      vfs.updateContent(p, content.value)
      savedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    }
  }, 500)
}

const offChanged = os.on('vfs:changed', (payload) => {
  const e = payload as VfsChangeEvent
  if (e.type === 'rename' && e.from === path.value) {
    wm.setPayload(winId, { path: e.path, key: e.path })
  }
})

onUnmounted(() => {
  window.clearTimeout(timer)
  offChanged()
})
</script>

<template>
  <div class="flex h-full flex-col text-[13px]">
    <div class="flex items-center gap-3 border-b border-slate-200/70 px-4 py-2 text-slate-600">
      <span class="truncate font-medium text-slate-700">{{ node?.name ?? '未关联文件' }}</span>
      <span class="flex-1" />
      <span v-if="savedAt" class="text-emerald-600">已保存 {{ savedAt }}</span>
      <span v-else-if="node" class="text-slate-400">编辑中…</span>
    </div>

    <div v-if="missing" class="flex flex-1 flex-col items-center justify-center gap-2 text-slate-400">
      <OsIcon name="trash-2" :size="48" :stroke-width="1.5" class="text-slate-300" />
      <p>文件已被删除或移动</p>
    </div>
    <textarea
      v-else
      v-model="content"
      class="min-h-0 flex-1 resize-none bg-transparent p-5 leading-relaxed text-slate-700 outline-none"
      placeholder="开始输入…"
      @input="onInput"
    />
  </div>
</template>
