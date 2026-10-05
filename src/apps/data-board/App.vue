<script setup lang="ts">
import { ref, watch } from 'vue'
import { createFixtureDataSource } from '@/kernel/data/fixtureDataSource'
import type { SortSpec } from '@/kernel/data/types'
import OsButton from '@/ui/OsButton.vue'
import OsDialog from '@/ui/OsDialog.vue'
import OsForm, { type FormField } from '@/ui/OsForm.vue'
import OsInput from '@/ui/OsInput.vue'
import OsSelect from '@/ui/OsSelect.vue'
import OsSwitch from '@/ui/OsSwitch.vue'
import OsTable, { type TableColumn } from '@/ui/OsTable.vue'
import { DEPTS, SEED, type Employee } from './seed'

const PAGE_SIZE = 8

// 模拟异常开关：打开后数据源所有操作 reject，用于演示 error 三态、可重试与乐观回滚
const failMode = ref(false)

const ds = createFixtureDataSource<Employee>({
  seed: SEED,
  latency: 320,
  failWhen: () => failMode.value,
  idKey: 'id',
  textKeys: ['name', 'role', 'dept'],
})

const rows = ref<Employee[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const page = ref(1)
const keyword = ref('')
const dept = ref('')
const sort = ref<SortSpec | undefined>(undefined)

const deptOptions = [
  { value: '', label: '全部部门' },
  ...DEPTS.map((d) => ({ value: d, label: d })),
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await ds.query({
      page: page.value,
      pageSize: PAGE_SIZE,
      sort: sort.value,
      filter: { dept: dept.value || undefined },
      keyword: keyword.value,
    })
    rows.value = res.rows
    total.value = res.total
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

// 统一重置到首页再加载，且只触发一次 load（page 已是 1 时 watcher 不会重复触发）
function reload() {
  if (page.value === 1) load()
  else page.value = 1
}

watch(page, load, { immediate: true })
watch(dept, reload)
watch(failMode, reload)

function onSort({ key, order }: { key: string; order: 'asc' | 'desc' | null }) {
  sort.value = order ? { key, order } : undefined
  reload()
}

// 乐观更新 + 失败回滚：删除先本地生效，数据源 reject 后还原快照
async function onDelete(row: Employee) {
  const snapshot = { rows: rows.value, total: total.value }
  rows.value = rows.value.filter((r) => r.id !== row.id)
  total.value = Math.max(0, total.value - 1)
  try {
    await ds.remove(row.id)
  } catch {
    rows.value = snapshot.rows
    total.value = snapshot.total
  }
}

const dialog = ref<{ mode: 'create' | 'edit'; id?: number } | null>(null)
const formRef = ref<InstanceType<typeof OsForm> | null>(null)
const formModel = ref<Record<string, unknown>>({})

const fields: FormField[] = [
  { key: 'name', label: '姓名', type: 'input', required: true, min: 1 },
  {
    key: 'dept',
    label: '部门',
    type: 'select',
    required: true,
    options: DEPTS.map((d) => ({ value: d, label: d })),
  },
  { key: 'role', label: '职位', type: 'input', required: true },
  { key: 'salary', label: '薪资', type: 'input', placeholder: '数字，可留空' },
  { key: 'joinedAt', label: '入职日期', type: 'input', placeholder: 'YYYY-MM-DD' },
]

function openCreate() {
  formModel.value = { name: '', dept: DEPTS[0], role: '', salary: '', joinedAt: '' }
  dialog.value = { mode: 'create' }
}

function openEdit(row: Employee) {
  formModel.value = { ...row, salary: String(row.salary) }
  dialog.value = { mode: 'edit', id: row.id }
}

async function confirmDialog() {
  if (!formRef.value?.validate() || !dialog.value) return
  const d = dialog.value
  const payload = {
    name: String(formModel.value.name ?? '').trim(),
    dept: String(formModel.value.dept ?? ''),
    role: String(formModel.value.role ?? '').trim(),
    salary: Number(formModel.value.salary) || 0,
    joinedAt: String(formModel.value.joinedAt ?? '').trim(),
  }
  try {
    if (d.mode === 'create') await ds.create(payload)
    else await ds.update(d.id as number, payload)
    dialog.value = null
    await load()
  } catch {
    /* 数据源已集中上报（console.warn + 通知中心）；保留对话框供重试 */
  }
}

const columns: TableColumn<Employee>[] = [
  { key: 'name', title: '姓名', sortable: true, width: '110px' },
  { key: 'dept', title: '部门', width: '96px' },
  { key: 'role', title: '职位', width: '130px' },
  { key: 'salary', title: '薪资', sortable: true, align: 'right', width: '100px' },
  { key: 'joinedAt', title: '入职日期', sortable: true, width: '120px' },
]
</script>

<template>
  <div class="flex h-full flex-col text-ui">
    <div class="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
      <div class="w-44 w-narrow:w-full">
        <OsInput v-model="keyword" placeholder="搜索姓名/职位" @enter="reload" />
      </div>
      <div class="w-32 w-narrow:w-full">
        <OsSelect v-model="dept" :options="deptOptions" placeholder="" />
      </div>
      <OsButton size="sm" @click="reload">查询</OsButton>
      <div class="ml-auto flex items-center gap-3">
        <OsSwitch v-model="failMode" label="模拟异常" />
        <OsButton size="sm" variant="primary" @click="openCreate">新增</OsButton>
      </div>
    </div>

    <div class="min-h-0 flex-1">
      <OsTable
        v-model:page="page"
        remote
        :columns="columns"
        :rows="rows"
        :loading="loading"
        :error="error"
        :total="total"
        :page-size="PAGE_SIZE"
        row-key="id"
        empty-text="没有匹配的记录"
        @sort-change="onSort"
        @retry="load"
      >
        <template #actions="{ row }">
          <div class="flex justify-end gap-2">
            <button class="text-accent-strong hover:underline" @click="openEdit(row as Employee)">
              编辑
            </button>
            <button class="text-danger hover:underline" @click="onDelete(row as Employee)">
              删除
            </button>
          </div>
        </template>
      </OsTable>
    </div>

    <OsDialog
      v-if="dialog"
      :title="dialog.mode === 'create' ? '新增员工' : '编辑员工'"
      @confirm="confirmDialog"
      @cancel="dialog = null"
    >
      <OsForm ref="formRef" v-model="formModel" :fields="fields" layout="vertical">
        <template #actions><span /></template>
      </OsForm>
    </OsDialog>
  </div>
</template>
