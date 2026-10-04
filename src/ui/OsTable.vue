<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import OsEmpty from './OsEmpty.vue'
import OsSkeleton from './OsSkeleton.vue'
import OsPagination from './OsPagination.vue'

export interface TableColumn<T> {
  key: keyof T & string
  title: string
  width?: string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  /** 具名插槽名；提供后用该插槽自定义单元格，否则直接渲染 row[key] */
  slot?: string
}

export type SortOrder = 'asc' | 'desc' | null

const props = withDefaults(
  defineProps<{
    columns: TableColumn<T>[]
    rows: T[]
    rowKey?: keyof T & string
    loading?: boolean
    selectable?: boolean
    /** 排序/分页由远端驱动时为 true：表格只做展示与事件派发，不本地排序 */
    remote?: boolean
    emptyText?: string
    /** 非空字符串时进入 error 三态，覆盖 loading/empty；配合 @retry 重试 */
    error?: string
    pageSize?: number
    total?: number
  }>(),
  {
    rowKey: 'id',
    loading: false,
    selectable: false,
    remote: false,
    emptyText: '',
    error: '',
    pageSize: 10,
    total: undefined,
  },
)

const { t } = useI18n()

const emit = defineEmits<{
  'sort-change': [payload: { key: string; order: SortOrder }]
  'row-click': [row: T]
  'row-dblclick': [row: T]
  retry: []
}>()

const selected = defineModel<(string | number)[]>('selected', { default: () => [] })
const page = defineModel<number>('page', { default: 1 })

const sortKey = ref<string | null>(null)
const sortOrder = ref<SortOrder>(null)

const alignCls = (a?: string) =>
  a === 'center' ? 'text-center' : a === 'right' ? 'text-right' : 'text-left'

const displayRows = computed(() => {
  if (props.remote || !sortKey.value || !sortOrder.value) return props.rows
  const dir = sortOrder.value === 'asc' ? 1 : -1
  const k = sortKey.value
  return [...props.rows].sort((a, b) => {
    const av = a[k]
    const bv = b[k]
    if (av == null && bv == null) return 0
    if (av == null) return -1 * dir
    if (bv == null) return 1 * dir
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv), 'zh-CN') * dir
  })
})

const allChecked = computed(
  () =>
    displayRows.value.length > 0 &&
    displayRows.value.every((r) => selected.value.includes(r[props.rowKey] as string | number)),
)

function toggleSort(col: TableColumn<T>) {
  if (!col.sortable) return
  if (sortKey.value !== col.key) {
    sortKey.value = col.key
    sortOrder.value = 'asc'
  } else {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : sortOrder.value === 'desc' ? null : 'asc'
    if (sortOrder.value === null) sortKey.value = null
  }
  emit('sort-change', { key: col.key, order: sortOrder.value })
}

function keyOf(row: T) {
  return row[props.rowKey] as string | number
}

function toggleAll() {
  selected.value = allChecked.value ? [] : displayRows.value.map(keyOf)
}

function toggleRow(row: T) {
  const k = keyOf(row)
  selected.value = selected.value.includes(k)
    ? selected.value.filter((x) => x !== k)
    : [...selected.value, k]
}
</script>

<template>
  <div class="flex h-full flex-col text-ui">
    <div class="min-h-0 flex-1 overflow-auto">
      <table class="w-full border-collapse">
        <thead class="sticky top-0 z-10 bg-surface-sunken/95 backdrop-blur">
          <tr class="border-b border-line">
            <th v-if="selectable" class="w-9 px-2 py-2">
              <input type="checkbox" :checked="allChecked" @change="toggleAll" />
            </th>
            <th
              v-for="col in columns"
              :key="col.key"
              class="px-3 py-2 font-medium text-ink-mute"
              :class="[
                alignCls(col.align),
                col.sortable && 'cursor-pointer select-none hover:text-ink',
              ]"
              :style="col.width ? { width: col.width } : undefined"
              @click="toggleSort(col)"
            >
              <span class="inline-flex items-center gap-1">
                {{ col.title }}
                <span v-if="col.sortable && sortKey === col.key" class="text-accent-strong">
                  {{ sortOrder === 'asc' ? '↑' : '↓' }}
                </span>
              </span>
            </th>
            <!-- 逃生口：行操作列表头 -->
            <th v-if="$slots.actions" class="w-24 px-3 py-2 text-right font-medium text-ink-mute">
              {{ t('common.actions') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="error">
            <td
              :colspan="columns.length + (selectable ? 1 : 0) + ($slots.actions ? 1 : 0)"
              class="p-4"
            >
              <OsEmpty icon="x" :description="error">
                <template #action>
                  <button
                    class="rounded-md border border-line px-3 py-1 text-ui text-ink hover:bg-surface-hover"
                    @click="emit('retry')"
                  >
                    {{ t('common.retry') }}
                  </button>
                </template>
              </OsEmpty>
            </td>
          </tr>
          <tr v-else-if="loading">
            <td
              :colspan="columns.length + (selectable ? 1 : 0) + ($slots.actions ? 1 : 0)"
              class="p-4"
            >
              <OsSkeleton :rows="4" />
            </td>
          </tr>
          <template v-else>
            <tr
              v-for="row in displayRows"
              :key="keyOf(row)"
              class="border-b border-line-soft transition hover:bg-accent-soft/40"
              @click="emit('row-click', row)"
              @dblclick="emit('row-dblclick', row)"
            >
              <td v-if="selectable" class="px-2 py-2" @click.stop>
                <input
                  type="checkbox"
                  :checked="selected.includes(keyOf(row))"
                  @change="toggleRow(row)"
                />
              </td>
              <td
                v-for="col in columns"
                :key="col.key"
                class="px-3 py-2 text-ink"
                :class="alignCls(col.align)"
              >
                <slot v-if="col.slot" :name="col.slot" :row="row" :value="row[col.key]" />
                <template v-else>{{ row[col.key] }}</template>
              </td>
              <td v-if="$slots.actions" class="px-3 py-2 text-right" @click.stop>
                <slot name="actions" :row="row" />
              </td>
            </tr>
            <tr v-if="displayRows.length === 0">
              <td :colspan="columns.length + (selectable ? 1 : 0) + ($slots.actions ? 1 : 0)">
                <OsEmpty :description="emptyText || t('common.empty')">
                  <template #action><slot name="empty-action" /></template>
                </OsEmpty>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <div v-if="total !== undefined" class="shrink-0 border-t border-line px-3 py-2">
      <OsPagination v-model="page" :page-size="pageSize" :total="total" />
    </div>
  </div>
</template>
