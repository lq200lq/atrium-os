<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, ref } from 'vue'
import { useText } from './internal/text'
import type { SortOrder, TableColumn } from './types'
import OsEmpty from './OsEmpty.vue'
import OsSpin from './OsSpin.vue'
import OsPagination from './OsPagination.vue'

export type { SortOrder, TableColumn } from './types'

const props = withDefaults(
  defineProps<{
    /** 列定义；col.slot 存在时单元格走同名具名插槽，否则直接渲染 row[col.key] */
    columns: TableColumn<T>[]
    /** 数据行；本地排序只重排内部副本、不改写原数组；非 remote 且给了 total 时由组件按页截取 */
    rows: T[]
    /** 行唯一键字段名：行 :key 与 v-model:selected 存的值都取该字段 */
    rowKey?: keyof T & string
    /** 加载态，表格区内居中渲染 OsSpin（S10 loading 契约，非骨架屏） */
    loading?: boolean
    /** 显示首列复选框；全选作用于当前展示行并把 key 写回 v-model:selected */
    selectable?: boolean
    /** 排序/分页由远端驱动时为 true：表格只做展示与事件派发，不本地排序 */
    remote?: boolean
    /** 空状态文案，空串回退 common.empty；error/loading 态不消费 */
    emptyText?: string
    /** 非空字符串时进入 error 三态，覆盖 loading/empty；配合 @retry 重试 */
    error?: string
    /** 每页条数：透传给页脚 OsPagination，并在本地模式（非 remote）下决定表体每页截取多少行 */
    pageSize?: number
    /** 传入（非 undefined）才渲染分页页脚；本地模式下同时启用按页截取，远端模式仅出页码不截行 */
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

const { t } = useText()

const emit = defineEmits<{
  /** 点击 sortable 列表头派发；order 循环 asc→desc→null，本地模式同时重排展示，remote 模式仅通知父级 */
  'sort-change': [payload: { key: string; order: SortOrder }]
  /** 单击数据行派发；选择列与 actions 列的点击已 stop，不会触发 */
  'row-click': [row: T]
  /** 双击数据行派发；紧随其前的 row-click 也会发出 */
  'row-dblclick': [row: T]
  /** error 三态下点击内建重试按钮派发；组件自身不重新请求 */
  retry: []
}>()

const selected = defineModel<(string | number)[]>('selected', { default: () => [] })
const page = defineModel<number>('page', { default: 1 })

const sortKey = ref<string | null>(null)
const sortOrder = ref<SortOrder>(null)

const alignCls = (a?: string) =>
  a === 'center' ? 'text-center' : a === 'right' ? 'text-right' : 'text-left'

const sortedRows = computed(() => {
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

/**
 * 展示行。本地模式（非 remote）且给了 total 时按 v-model:page 截取当前页——
 * 否则页脚能翻页、表体却永远显示全部行，「分页」是假的。remote 模式不截：
 * 父级只传当页数据，再截会把远端第二页起的内容清空。
 */
const displayRows = computed(() => {
  if (props.remote || props.total === undefined) return sortedRows.value
  const start = (page.value - 1) * props.pageSize
  return sortedRows.value.slice(start, start + props.pageSize)
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

/** 行勾选框的可访问名：取第一列单元格文本（与表体渲染同源），空/对象值回落行 key——都是数据，不造文案 */
function rowLabel(row: T): string {
  const first = props.columns[0]
  const v = first ? row[first.key] : undefined
  const s = v === null || typeof v === 'object' ? '' : String(v)
  return s.trim() !== '' ? s : String(keyOf(row))
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
        <thead class="sticky top-0 z-sticky bg-surface-sunken/95 backdrop-blur">
          <tr class="border-b border-line">
            <th v-if="selectable" class="w-9 px-2 py-2">
              <input
                type="checkbox"
                :aria-label="t('common.all')"
                :checked="allChecked"
                @change="toggleAll"
              />
            </th>
            <th
              v-for="col in columns"
              :key="col.key"
              class="px-3 py-2 font-strong text-ink-mute"
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
            <th v-if="$slots.actions" class="w-24 px-3 py-2 text-right font-strong text-ink-mute">
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
                    class="inline-flex h-control-sm items-center rounded-control border border-line px-sm text-ui text-ink hover:bg-surface-hover"
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
              <!-- loading 态消费 S10 中性 loading 契约（OsSpin），不再自写 -->
              <div class="flex justify-center">
                <OsSpin />
              </div>
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
                  :aria-label="rowLabel(row)"
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
