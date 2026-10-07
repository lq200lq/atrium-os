<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import { commandBus } from '@/kernel/bus/commandBus'
import { useOS } from '@/kernel/composables/useOS'
import { useWindowContext } from '@/kernel/composables/useWindowContext'
import { createVfsDataSource } from '@/kernel/data/vfsDataSource'
import {
  baseName,
  formatSize,
  isUnderTrash,
  parentOf,
  TRASH_ROOT,
  type FsNode,
} from '@/kernel/fs/types'
import { fileIconClass, fileIconName } from '@/kernel/icons'
import { useVfs } from '@/kernel/stores/vfs'
import OsBreadcrumb from '@/ui/OsBreadcrumb.vue'
import OsButton from '@/ui/OsButton.vue'
import OsDialog from '@/ui/OsDialog.vue'
import OsForm, { type FormField } from '@/ui/OsForm.vue'
import OsTable, { type TableColumn } from '@/ui/OsTable.vue'
import OsTree, { type TreeNode } from '@/ui/OsTree.vue'
import { useFeedback } from '@/ui/feedback'
import type { BreadcrumbItem } from '@/ui/types'

interface Row extends Record<string, unknown> {
  id: string
  name: string
  isDir: boolean
  kind: string
  size: number
  sizeText: string
  updatedAt: number
  updatedText: string
  path: string
  icon: ReturnType<typeof fileIconName>
  iconCls: string
}

const vfs = useVfs()
const os = useOS()
const feedback = useFeedback()
const { t, locale } = useI18n()
const ds = createVfsDataSource()
const HOME = '/我的文件'
const cwd = ref(HOME)
const selected = ref<(string | number)[]>([])
const rows = ref<Row[]>([])
const loading = ref(false)
const error = ref('')
const formRef = ref<InstanceType<typeof OsForm> | null>(null)
const dialog = ref<{ mode: 'mkdir' | 'newfile' | 'rename' } | null>(null)
const formModel = ref<Record<string, unknown>>({ name: '' })

const nameField: FormField[] = [
  { key: 'name', label: t('fileManager.name'), type: 'input', required: true, min: 1 },
]

const inTrash = computed(() => isUnderTrash(cwd.value))

// 目录树只铺目录；文件留在右侧列表。平铺 nodes 经 ls getter 递归成嵌套数据，
// 随 vfs store 响应式重建，无需订阅 vfs:changed 单独刷新
function dirTree(dir: string): TreeNode[] {
  return vfs
    .ls(dir)
    .filter((n) => n.type === 'dir')
    .map((n) => ({ key: n.path, label: n.name, children: dirTree(n.path) }))
}

const treeData = computed<TreeNode[]>(() => [
  { key: HOME, label: '我的文件', children: dirTree(HOME) },
  {
    key: TRASH_ROOT,
    label: vfs.trash.length ? `回收站（${vfs.trash.length}）` : '回收站',
    children: dirTree(TRASH_ROOT),
  },
])
const treeExpanded = ref<string[]>([])

function onTreeSelect(node: TreeNode) {
  navigate(node.key)
}

function toRow(node: FsNode): Row {
  const isDir = node.type === 'dir'
  return {
    id: node.path,
    name: node.name,
    isDir,
    kind: isDir
      ? t('fileManager.kindDir')
      : (node.name.split('.').pop()?.toUpperCase() ?? t('fileManager.kindFile')),
    size: node.size,
    sizeText: isDir
      ? t('fileManager.items', { n: vfs.ls(node.path).length })
      : formatSize(node.size),
    updatedAt: node.updatedAt,
    updatedText: new Date(node.updatedAt).toLocaleString(locale.value, { hour12: false }),
    path: node.path,
    icon: fileIconName(node),
    iconCls: fileIconClass(node),
  }
}

// 经统一契约读取；file-manager 不分页，取全量后由 vfs.ls 的目录优先排序呈现
async function reload() {
  loading.value = true
  error.value = ''
  try {
    const res = await ds.query({
      page: 1,
      pageSize: Number.MAX_SAFE_INTEGER,
      filter: { dir: cwd.value, trash: inTrash.value },
    })
    rows.value = res.rows.map(toRow)
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('fileManager.loadFailed')
  } finally {
    loading.value = false
  }
}

let offBus: (() => void) | null = null
onMounted(() => {
  offBus = commandBus.on('vfs:changed', reload)
})
onUnmounted(() => offBus?.())
watch(cwd, reload, { immediate: true })

const columns = computed<TableColumn<Row>[]>(() => [
  { key: 'name', title: t('fileManager.name'), sortable: true, slot: 'name' },
  { key: 'kind', title: t('fileManager.kind'), width: '88px' },
  { key: 'sizeText', title: t('fileManager.size'), width: '96px', align: 'right' },
  ...(inTrash.value
    ? []
    : [
        {
          key: 'updatedText',
          title: t('fileManager.updated'),
          width: '170px',
          sortable: true,
        } as TableColumn<Row>,
      ]),
])

// 路径栏数据：每段一个层级（key 即 cwd），交给 OsBreadcrumb 渲染；
// 行为保持：点任意祖先层级切换 cwd，末项为当前目录
const crumbs = computed<BreadcrumbItem[]>(() => {
  const parts = cwd.value.split('/').filter(Boolean)
  return parts.map((name, i) => ({ key: `/${parts.slice(0, i + 1).join('/')}`, label: name }))
})

function onCrumbClick(item: BreadcrumbItem) {
  if (item.key) navigate(item.key)
}

const selectedPath = computed(() => (selected.value[0] as string | undefined) ?? null)

const dialogTitle = computed(() =>
  dialog.value?.mode === 'mkdir'
    ? t('fileManager.newDir')
    : dialog.value?.mode === 'newfile'
      ? t('fileManager.newFile')
      : t('fileManager.rename'),
)

function navigate(path: string) {
  cwd.value = path
  selected.value = []
}

function onRowDblClick(row: Row) {
  if (row.isDir) navigate(row.path)
  else os.exec('doc-editor:open', { key: row.path, path: row.path })
}

function openDialog(mode: 'mkdir' | 'newfile' | 'rename') {
  formModel.value = {
    name:
      mode === 'rename' && selectedPath.value
        ? baseName(selectedPath.value)
        : mode === 'mkdir'
          ? t('fileManager.newDir')
          : t('fileManager.defaultFileName'),
  }
  dialog.value = { mode }
}

async function confirmDialog() {
  if (!formRef.value?.validate()) return
  const d = dialog.value
  const name = String(formModel.value.name ?? '').trim()
  if (!d || !name) return
  try {
    if (d.mode === 'mkdir') await ds.create({ path: `${cwd.value}/${name}`, type: 'dir' })
    else if (d.mode === 'newfile')
      await ds.create({ path: `${cwd.value}/${name}`, type: 'file', content: '（占位内容）' })
    else if (d.mode === 'rename' && selectedPath.value)
      await ds.update(selectedPath.value, { name })
    dialog.value = null
    selected.value = []
  } catch {
    /* 数据源已集中上报；保留对话框供重试 */
  }
}

async function onDelete() {
  if (!selectedPath.value) return
  const path = selectedPath.value
  const name = baseName(path)
  // 破坏性动作先过命令式确认：反馈上下文由壳层的 FeedbackHost 提供，
  // 确认态与通知都走同一条 store 队列，不在应用内另起一套对话框状态
  const ok = await feedback.confirm({
    title: t('fileManager.trashTitle'),
    content: t('fileManager.trashBody', { name }),
    okText: t('fileManager.trashOk'),
  })
  if (!ok) return
  selected.value = []
  await ds.remove(path)
  feedback.success(t('fileManager.trashed'), name)
}

// 还原为回收站专有动作，不在通用 CRUD 契约内，直接走 vfs store
function onRestore() {
  const path = selectedPath.value
  if (!path) return
  const node = vfs.byPath(path)
  selected.value = []
  if (node?.trashedFrom) vfs.restore(path)
}

/* ── 消费下钻 payload（§4.9 依赖清单 2）：open('file-manager', { path, key }) 直达并选中该路径 ──
 * recent-files 带文件路径、storage 带分类目录；`key` 是窗口身份（多实例复用只在 key 匹配时发生），
 * 约定一律 { path, key }（§8 偏差 7）。
 * 沿用既有导航：目录 → navigate；文件 → 进父目录并选中该行，同时展开侧栏树祖先。 */
const { win } = useWindowContext()
const payloadPath = computed(() => (win.value?.payload as { path?: string } | undefined)?.path)

function revealPath(path: string) {
  const node = vfs.byPath(path)
  if (!node) return // 路径已不存在（比如文件被移走）：保持当前视图，不乱跳
  const dir = node.type === 'dir' ? path : parentOf(path)
  navigate(dir)
  if (node.type === 'file') selected.value = [path]
  // 展开侧栏目录树祖先，让落点在导航里可见（根节点恒可见，从第二段起补）
  const parts = dir.split('/').filter(Boolean)
  const ancestors: string[] = []
  for (let i = 2; i <= parts.length; i++) ancestors.push(`/${parts.slice(0, i).join('/')}`)
  treeExpanded.value = [...new Set([...treeExpanded.value, ...ancestors])]
}

// VFS 晚于本组件就绪（首屏并发还原）；窗口复用时 payload 变化也会再次触发
watch(
  [payloadPath, () => vfs.ready],
  ([p, ready]) => {
    if (p && ready) revealPath(p)
  },
  { immediate: true },
)
</script>

<template>
  <div class="relative flex h-full text-ui">
    <aside class="w-44 shrink-0 overflow-y-auto border-r border-line bg-surface-sunken/60 p-2">
      <OsTree
        v-model:expanded-keys="treeExpanded"
        :data="treeData"
        :selected-keys="[cwd]"
        @select="onTreeSelect"
      />
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <div class="flex items-center gap-2 border-b border-line px-4 py-2">
        <OsBreadcrumb :items="crumbs" class="min-w-0 flex-1" @click="onCrumbClick" />
        <template v-if="!inTrash">
          <OsButton size="sm" variant="primary" @click="openDialog('mkdir')">{{
            t('fileManager.newDir')
          }}</OsButton>
          <OsButton size="sm" variant="primary" @click="openDialog('newfile')">{{
            t('fileManager.newFile')
          }}</OsButton>
          <OsButton size="sm" :disabled="!selectedPath" @click="openDialog('rename')">{{
            t('fileManager.rename')
          }}</OsButton>
          <OsButton size="sm" variant="danger" :disabled="!selectedPath" @click="onDelete">
            {{ t('common.delete') }}
          </OsButton>
        </template>
        <OsButton v-else size="sm" variant="primary" :disabled="!selectedPath" @click="onRestore">
          {{ t('fileManager.restore') }}
        </OsButton>
      </div>

      <div class="min-h-0 flex-1">
        <OsTable
          v-model:selected="selected"
          :columns="columns"
          :rows="rows"
          :loading="loading"
          :error="error"
          row-key="id"
          selectable
          :empty-text="inTrash ? t('fileManager.emptyTrash') : t('fileManager.emptyDir')"
          @row-dblclick="onRowDblClick"
          @retry="reload"
        >
          <template #name="{ row }">
            <span class="inline-flex items-center gap-2">
              <OsIcon :name="row.icon" :size="16" :class="row.iconCls" />
              <span class="truncate">{{ row.name }}</span>
            </span>
          </template>
        </OsTable>
      </div>
    </div>

    <OsDialog v-if="dialog" :title="dialogTitle" @confirm="confirmDialog" @cancel="dialog = null">
      <OsForm ref="formRef" v-model="formModel" :fields="nameField" layout="vertical">
        <template #actions><span /></template>
      </OsForm>
    </OsDialog>
  </div>
</template>
