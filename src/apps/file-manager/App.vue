<script setup lang="ts">
import { computed, ref } from 'vue'
import OsIcon from '@/components/OsIcon.vue'
import { useOS } from '@/kernel/composables/useOS'
import { baseName, formatSize, isUnderTrash, TRASH_ROOT, type FsNode } from '@/kernel/fs/types'
import { fileIconClass, fileIconName } from '@/kernel/icons'
import { useVfs } from '@/kernel/stores/vfs'
import OsButton from '@/ui/OsButton.vue'
import OsDialog from '@/ui/OsDialog.vue'
import OsInput from '@/ui/OsInput.vue'

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
  dialog.value?.mode === 'mkdir'
    ? '新建目录'
    : dialog.value?.mode === 'newfile'
      ? '新建文档'
      : '重命名',
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
  <div class="relative flex h-full text-ui">
    <aside class="w-36 shrink-0 space-y-1 border-r border-slate-200/70 bg-slate-50/60 p-2">
      <button
        class="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-ink hover:bg-white"
        :class="{ 'bg-accent-soft text-accent-strong': cwd === HOME }"
        @click="navigate(HOME)"
      >
        我的文件
      </button>
      <button
        class="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-ink hover:bg-white"
        :class="{ 'bg-accent-soft text-accent-strong': inTrash }"
        @click="navigate(TRASH_ROOT)"
      >
        回收站
        <span v-if="vfs.trash.length" class="rounded bg-slate-200 px-1.5 text-caption text-ink">
          {{ vfs.trash.length }}
        </span>
      </button>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <div class="flex items-center gap-2 border-b border-slate-200/70 px-4 py-2">
        <nav class="flex min-w-0 flex-1 items-center gap-1 text-ink">
          <template v-for="(c, i) in crumbs" :key="c.path">
            <span v-if="i > 0" class="text-ink-mute">/</span>
            <button class="truncate rounded px-1 hover:bg-slate-100" @click="navigate(c.path)">
              {{ c.name }}
            </button>
          </template>
        </nav>
        <template v-if="!inTrash">
          <OsButton size="sm" variant="primary" @click="openDialog('mkdir')">新建目录</OsButton>
          <OsButton size="sm" variant="primary" @click="openDialog('newfile')">新建文档</OsButton>
          <OsButton size="sm" :disabled="!selected" @click="openDialog('rename')">重命名</OsButton>
          <OsButton size="sm" variant="danger" :disabled="!selected" @click="vfs.remove(selected!)">
            删除
          </OsButton>
        </template>
        <OsButton
          v-else
          size="sm"
          variant="primary"
          :disabled="!selected"
          @click="vfs.restore(selected!)"
        >
          还原
        </OsButton>
      </div>

      <div
        class="grid flex-1 grid-cols-4 content-start gap-2 overflow-y-auto p-4"
        @click.self="selected = null"
      >
        <button
          v-for="node in items"
          :key="node.path"
          class="flex flex-col items-center gap-1 rounded-lg p-3 hover:bg-accent-soft"
          :class="{ 'bg-accent-soft/80 hover:bg-accent-soft': selected === node.path }"
          @click="selected = node.path"
          @dblclick="onDoubleClick(node)"
        >
          <OsIcon :name="fileIconName(node)" :size="32" :class="fileIconClass(node)" />
          <span class="w-full truncate text-center text-ink">{{ node.name }}</span>
          <span class="text-caption text-ink-mute">{{ metaOf(node) }}</span>
        </button>
        <p v-if="items.length === 0" class="col-span-4 py-10 text-center text-ink-mute">
          {{ inTrash ? '回收站是空的' : '此目录为空' }}
        </p>
      </div>
    </div>

    <OsDialog v-if="dialog" :title="dialogTitle" @confirm="confirmDialog" @cancel="dialog = null">
      <OsInput v-model="dialog.name" @enter="confirmDialog" @esc="dialog = null" />
    </OsDialog>
  </div>
</template>
