<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import OsIcon from '@/components/OsIcon.vue'
import { commandBus } from '@/kernel/bus/commandBus'
import { useOS } from '@/kernel/composables/useOS'
import { createVfsDataSource } from '@/kernel/data/vfsDataSource'
import { baseName, formatSize, isUnderTrash, TRASH_ROOT, type FsNode } from '@/kernel/fs/types'
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
  { key: 'name', label: '名称', type: 'input', required: true, min: 1 },
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
    kind: isDir ? '目录' : (node.name.split('.').pop()?.toUpperCase() ?? '文件'),
    size: node.size,
    sizeText: isDir ? `${vfs.ls(node.path).length} 项` : formatSize(node.size),
    updatedAt: node.updatedAt,
    updatedText: new Date(node.updatedAt).toLocaleString('zh-CN', { hour12: false }),
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
    error.value = e instanceof Error ? e.message : '加载失败'
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
  { key: 'name', title: '名称', sortable: true, slot: 'name' },
  { key: 'kind', title: '类型', width: '88px' },
  { key: 'sizeText', title: '大小', width: '96px', align: 'right' },
  ...(inTrash.value
    ? []
    : [
        {
          key: 'updatedText',
          title: '修改时间',
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
    ? '新建目录'
    : dialog.value?.mode === 'newfile'
      ? '新建文档'
      : '重命名',
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
          ? '新建目录'
          : '新建文档.txt',
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
    title: '移入回收站',
    content: `确定要将「${name}」移入回收站吗？可从回收站还原。`,
    okText: '移入回收站',
  })
  if (!ok) return
  selected.value = []
  await ds.remove(path)
  feedback.success('已移入回收站', name)
}

// 还原为回收站专有动作，不在通用 CRUD 契约内，直接走 vfs store
function onRestore() {
  const path = selectedPath.value
  if (!path) return
  const node = vfs.byPath(path)
  selected.value = []
  if (node?.trashedFrom) vfs.restore(path)
}
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
          <OsButton size="sm" variant="primary" @click="openDialog('mkdir')">新建目录</OsButton>
          <OsButton size="sm" variant="primary" @click="openDialog('newfile')">新建文档</OsButton>
          <OsButton size="sm" :disabled="!selectedPath" @click="openDialog('rename')"
            >重命名</OsButton
          >
          <OsButton size="sm" variant="danger" :disabled="!selectedPath" @click="onDelete">
            删除
          </OsButton>
        </template>
        <OsButton v-else size="sm" variant="primary" :disabled="!selectedPath" @click="onRestore">
          还原
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
          :empty-text="inTrash ? '回收站是空的' : '此目录为空'"
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
