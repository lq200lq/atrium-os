<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import OsIcon from '@/components/OsIcon.vue'
import type { TreeNode } from './types'

export type { TreeNode } from './types'

interface TreeRow {
  node: TreeNode
  key: string
  level: number
  parentKey: string | null
  hasChildren: boolean
  expanded: boolean
  checked: boolean
  half: boolean
  loading: boolean
  disabled: boolean
}

const props = withDefaults(
  defineProps<{
    data: TreeNode[]
    selectable?: boolean
    checkable?: boolean
    /** 懒加载：首次展开「无 children 且非叶子」的节点时调用，结果由组件内部缓存 */
    loadData?: (node: TreeNode) => Promise<TreeNode[]>
  }>(),
  { selectable: true, checkable: false, loadData: undefined },
)

const emit = defineEmits<{ select: [node: TreeNode] }>()

// 未绑定 v-model 时 defineModel 自动退化为内部状态（受控与非受控同一条路径）
const expandedKeys = defineModel<string[]>('expandedKeys', { default: () => [] })
const selectedKeys = defineModel<string[]>('selectedKeys', { default: () => [] })
const checkedKeys = defineModel<string[]>('checkedKeys', { default: () => [] })

const loadedChildren = ref<Record<string, TreeNode[]>>({})
const loadingKeys = ref<string[]>([])

const expandedSet = computed(() => new Set(expandedKeys.value))
const selectedSet = computed(() => new Set(selectedKeys.value))

const childrenOf = (node: TreeNode): TreeNode[] =>
  node.isLeaf ? [] : (node.children ?? loadedChildren.value[node.key] ?? [])

const isLazyBranch = (node: TreeNode): boolean =>
  !!props.loadData &&
  !node.isLeaf &&
  node.children === undefined &&
  loadedChildren.value[node.key] === undefined

// 勾选联动以「终端 key」为准：叶子节点自身；disabled 节点不计入父节点聚合
const terminalMap = computed(() => {
  const map = new Map<string, string[]>()
  const collect = (node: TreeNode): string[] => {
    if (node.disabled) {
      map.set(node.key, [node.key])
      return []
    }
    const kids = childrenOf(node)
    const term = kids.length === 0 ? [node.key] : kids.flatMap(collect)
    map.set(node.key, term)
    return term
  }
  props.data.forEach(collect)
  return map
})

const checkedTerminalSet = computed(() => {
  const set = new Set<string>()
  for (const key of checkedKeys.value) {
    const term = terminalMap.value.get(key)
    if (term) term.forEach((k) => set.add(k))
    else set.add(key)
  }
  return set
})

function checkState(node: TreeNode): { checked: boolean; half: boolean } {
  const term = terminalMap.value.get(node.key) ?? [node.key]
  if (node.disabled) return { checked: checkedTerminalSet.value.has(node.key), half: false }
  if (term.length === 0) return { checked: false, half: false }
  const hit = term.reduce((n, k) => n + (checkedTerminalSet.value.has(k) ? 1 : 0), 0)
  return { checked: hit === term.length, half: hit > 0 && hit < term.length }
}

function toggleCheck(node: TreeNode) {
  if (node.disabled) return
  const term = terminalMap.value.get(node.key) ?? [node.key]
  if (term.length === 0) return
  const on = checkState(node).checked
  const next = new Set(checkedTerminalSet.value)
  for (const k of term) {
    if (on) next.delete(k)
    else next.add(k)
  }
  checkedKeys.value = [...next]
}

const rows = computed<TreeRow[]>(() => {
  const out: TreeRow[] = []
  const walk = (list: TreeNode[], level: number, parentKey: string | null) => {
    for (const node of list) {
      const kids = childrenOf(node)
      const loading = loadingKeys.value.includes(node.key)
      const { checked, half } = checkState(node)
      out.push({
        node,
        key: node.key,
        level,
        parentKey,
        hasChildren: !node.isLeaf && (isLazyBranch(node) || loading || kids.length > 0),
        expanded: expandedSet.value.has(node.key),
        checked,
        half,
        loading,
        disabled: !!node.disabled,
      })
      if (expandedSet.value.has(node.key)) walk(kids, level + 1, node.key)
    }
  }
  walk(props.data, 1, null)
  return out
})

async function toggleExpand(node: TreeNode) {
  const key = node.key
  if (expandedSet.value.has(key)) {
    expandedKeys.value = expandedKeys.value.filter((k) => k !== key)
    return
  }

  if (isLazyBranch(node) && !loadingKeys.value.includes(key) && props.loadData) {
    loadingKeys.value = [...loadingKeys.value, key]
    try {
      const kids = await props.loadData(node)
      loadedChildren.value = { ...loadedChildren.value, [key]: kids }
    } finally {
      loadingKeys.value = loadingKeys.value.filter((k) => k !== key)
    }
  }
  expandedKeys.value = [...expandedKeys.value, key]
}

function onToggleClick(row: TreeRow) {
  if (row.hasChildren) void toggleExpand(row.node)
}

function selectNode(node: TreeNode) {
  if (node.disabled || !props.selectable) return
  if (!selectedKeys.value.includes(node.key)) selectedKeys.value = [node.key]
  emit('select', node)
}

const activeKey = ref<string | null>(null)
const rowRefs = new Map<string, HTMLElement>()

function setRowRef(key: string, el: unknown) {
  if (el instanceof HTMLElement) rowRefs.set(key, el)
  else rowRefs.delete(key)
}

const focusableKey = computed(() =>
  rows.value.some((r) => r.key === activeKey.value)
    ? activeKey.value
    : (rows.value[0]?.key ?? null),
)
const tabIndexFor = (key: string): number => (key === focusableKey.value ? 0 : -1)

function focusKey(key: string) {
  activeKey.value = key
  void nextTick(() => rowRefs.get(key)?.focus())
}

function moveActive(from: string, delta: number) {
  const idx = rows.value.findIndex((r) => r.key === from)
  const target = rows.value[idx + delta]
  if (target) focusKey(target.key)
}

function onRowKeydown(event: KeyboardEvent, row: TreeRow) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      moveActive(row.key, 1)
      break
    case 'ArrowUp':
      event.preventDefault()
      moveActive(row.key, -1)
      break
    case 'ArrowRight':
      event.preventDefault()
      if (row.hasChildren && !row.expanded) void toggleExpand(row.node)
      else {
        const child = rows.value.find((r) => r.parentKey === row.key)
        if (child) focusKey(child.key)
      }
      break
    case 'ArrowLeft':
      event.preventDefault()
      if (row.expanded) void toggleExpand(row.node)
      else if (row.parentKey) focusKey(row.parentKey)
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      if (props.checkable) toggleCheck(row.node)
      else if (props.selectable) selectNode(row.node)
      else if (row.hasChildren) void toggleExpand(row.node)
      break
  }
}
</script>

<template>
  <div role="tree" aria-multiselectable="false" class="flex flex-col gap-2xs text-ui">
    <div
      v-for="row in rows"
      :key="row.key"
      :ref="(el) => setRowRef(row.key, el)"
      role="treeitem"
      :tabindex="tabIndexFor(row.key)"
      :aria-level="row.level"
      :aria-expanded="row.hasChildren ? row.expanded : undefined"
      :aria-selected="selectable ? selectedSet.has(row.key) : undefined"
      :aria-disabled="row.disabled || undefined"
      class="flex h-control items-center gap-2xs rounded-control pr-xs text-ink transition duration-quick"
      :class="[
        selectedSet.has(row.key) ? 'bg-accent-soft text-accent-strong' : 'hover:bg-surface-hover',
        row.disabled && 'is-disabled',
      ]"
      :style="{ paddingLeft: `${(row.level - 1) * 12 + 4}px` }"
      @click="selectNode(row.node)"
      @focus="activeKey = row.key"
      @keydown="onRowKeydown($event, row)"
    >
      <span
        data-tree-toggle
        class="flex h-4 w-4 shrink-0 items-center justify-center"
        @click.stop="onToggleClick(row)"
      >
        <OsIcon
          v-if="row.loading"
          name="loader-circle"
          :size="14"
          class="animate-spin text-ink-mute"
        />
        <OsIcon
          v-else-if="row.hasChildren"
          name="chevron-down"
          :size="12"
          class="text-ink-mute transition-transform duration-quick"
          :class="row.expanded ? 'rotate-180' : '-rotate-90'"
        />
      </span>
      <input
        v-if="checkable"
        type="checkbox"
        class="h-4 w-4 shrink-0 rounded-chip accent-[var(--color-accent)]"
        :checked="row.checked"
        :indeterminate.prop="row.half"
        :disabled="row.disabled"
        @click.stop
        @change="toggleCheck(row.node)"
      />
      <span class="min-w-0 flex-1 truncate">{{ row.node.label }}</span>
    </div>
  </div>
</template>
