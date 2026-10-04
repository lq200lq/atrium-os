<script setup lang="ts">
import { computed, ref } from 'vue'
import OsIcon from '@/components/OsIcon.vue'
import { useOS } from '@/kernel/composables/useOS'
import { baseName, formatSize, isUnderTrash, TRASH_ROOT, type FsNode } from '@/kernel/fs/types'
import { fileIconClass, fileIconName } from '@/kernel/icons'
import { useVfs } from '@/kernel/stores/vfs'

const vfs = useVfs()
const os = useOS()
const HOME = '/我的文件'
const cwd = ref(HOME)
const selected = ref<string | null>(null)
const dialog = ref<{ mode: 'mkdir' | 'newfile' | 'rename'; name: string } | null>(null)

const inTrash = computed(() => isUnderTrash(cwd.value))
const items = computed(() => vfs.ls(cwd.value))
const crumbs = computed(() => {
  const parts = cwd.value.split('/').filter(Boolean)
  return parts.map((name, i) => ({ name, path: `/${parts.slice(0, i + 1).join('/')}` }))
})

const dialogTitle = computed(() =>
  dialog.value?.mode === 'mkdir' ? '新建目录' : dialog.value?.mode === 'newfile' ? '新建文档' : '重命名',
)

function metaOf(node: FsNode): string {
  return node.type === 'dir' ? `${vfs.ls(node.path).length} 项` : formatSize(node.size)
}

function navigate(path: string) {
  cwd.value = path
  selected.value = null
}

function onDoubleClick(node: FsNode) {
  if (node.type === 'dir') {
    navigate(node.path)
    return
  }
  os.exec('doc-editor:open', { key: node.path, path: node.path })
}

function openDialog(mode: 'mkdir' | 'newfile' | 'rename') {
  dialog.value = {
    mode,
    name:
      mode === 'rename' && selected.value
        ? baseName(selected.value)
        : mode === 'mkdir'
          ? '新建目录'
          : '新建文档.txt',
  }
}

function confirmDialog() {
  const d = dialog.value
  const name = d?.name.trim()
  if (!d || !name) return
  if (d.mode === 'mkdir') vfs.mkdir(cwd.value, name)
  else if (d.mode === 'newfile') vfs.writeFile(cwd.value, name, '（占位内容）')
  else if (d.mode === 'rename' && selected.value) vfs.rename(selected.value, name)
  dialog.value = null
  selected.value = null
}
</script>

<template>
  <div class="relative flex h-full text-[13px]">
    <aside class="w-36 shrink-0 space-y-1 border-r border-slate-200/70 bg-slate-50/60 p-2">
      <button
        class="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-slate-700 hover:bg-white"
        :class="{ 'bg-sky-100 text-sky-700': cwd === HOME }"
        @click="navigate(HOME)"
      >
        我的文件
      </button>
      <button
        class="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-slate-700 hover:bg-white"
        :class="{ 'bg-sky-100 text-sky-700': inTrash }"
        @click="navigate(TRASH_ROOT)"
      >
        回收站
        <span v-if="vfs.trash.length" class="rounded bg-slate-200 px-1.5 text-[11px] text-slate-600">
          {{ vfs.trash.length }}
        </span>
      </button>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <div class="flex items-center gap-2 border-b border-slate-200/70 px-4 py-2">
        <nav class="flex min-w-0 flex-1 items-center gap-1 text-slate-600">
          <template v-for="(c, i) in crumbs" :key="c.path">
            <span v-if="i > 0" class="text-slate-300">/</span>
            <button class="truncate rounded px-1 hover:bg-slate-100" @click="navigate(c.path)">
              {{ c.name }}
            </button>
          </template>
        </nav>
        <template v-if="!inTrash">
          <button class="rounded-md bg-sky-500 px-2.5 py-1 text-white hover:brightness-110" @click="openDialog('mkdir')">
            新建目录
          </button>
          <button class="rounded-md bg-sky-500 px-2.5 py-1 text-white hover:brightness-110" @click="openDialog('newfile')">
            新建文档
          </button>
          <button
            class="rounded-md border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            :disabled="!selected"
            @click="openDialog('rename')"
          >
            重命名
          </button>
          <button
            class="rounded-md border border-red-200 px-2.5 py-1 text-red-500 hover:bg-red-50 disabled:opacity-40"
            :disabled="!selected"
            @click="vfs.remove(selected!)"
          >
            删除
          </button>
        </template>
        <button
          v-else
          class="rounded-md bg-sky-500 px-2.5 py-1 text-white hover:brightness-110 disabled:opacity-40"
          :disabled="!selected"
          @click="vfs.restore(selected!)"
        >
          还原
        </button>
      </div>

      <div class="grid flex-1 grid-cols-4 content-start gap-2 overflow-y-auto p-4" @click.self="selected = null">
        <button
          v-for="node in items"
          :key="node.path"
          class="flex flex-col items-center gap-1 rounded-lg p-3 hover:bg-sky-50"
          :class="{ 'bg-sky-100/80 hover:bg-sky-100': selected === node.path }"
          @click="selected = node.path"
          @dblclick="onDoubleClick(node)"
        >
          <OsIcon :name="fileIconName(node)" :size="32" :class="fileIconClass(node)" />
          <span class="w-full truncate text-center text-slate-700">{{ node.name }}</span>
          <span class="text-[11px] text-slate-400">{{ metaOf(node) }}</span>
        </button>
        <p v-if="items.length === 0" class="col-span-4 py-10 text-center text-slate-400">
          {{ inTrash ? '回收站是空的' : '此目录为空' }}
        </p>
      </div>
    </div>

    <div
      v-if="dialog"
      class="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/25"
      @click.self="dialog = null"
    >
      <div class="w-72 rounded-xl bg-white p-4 shadow-xl">
        <p class="mb-3 font-medium text-slate-700">{{ dialogTitle }}</p>
        <input
          v-model="dialog.name"
          class="w-full rounded-md border border-slate-200 px-3 py-1.5 outline-none focus:border-sky-400"
          @keydown.enter="confirmDialog"
          @keydown.esc="dialog = null"
        />
        <div class="mt-4 flex justify-end gap-2">
          <button class="rounded-md px-3 py-1 text-slate-500 hover:bg-slate-100" @click="dialog = null">取消</button>
          <button class="rounded-md bg-sky-500 px-3 py-1 text-white hover:brightness-110" @click="confirmDialog">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>
