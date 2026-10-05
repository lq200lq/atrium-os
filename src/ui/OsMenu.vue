<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import OsIcon from '@/components/OsIcon.vue'
import type { MenuItem, MenuMode } from './types'

export type { MenuItem, MenuMode } from './types'

/** 键盘导航/渲染用的扁平行：depth 1 顶层，depth 2 子级（仅二级） */
interface MenuRow {
  item: MenuItem
  key: string
  depth: number
  parentKey: string | null
  hasChildren: boolean
  expanded: boolean
}

const props = withDefaults(
  defineProps<{
    /** 条目树；key 为选中与 click 事件的唯一标识，全局必须唯一；children 只支持二级 */
    items: MenuItem[]
    /** 排列模式：vertical 子菜单内联展开（上下键遍历），horizontal 子菜单浮出（左右键换组） */
    mode?: MenuMode
  }>(),
  { mode: 'vertical' },
)

const emit = defineEmits<{
  /** 选中叶子条目时派发（点击或 Enter/Space）；载荷为被选中的 key，disabled 项不响应 */
  click: [key: string]
}>()

// 未绑定 v-model 时 defineModel 自动退化为内部状态（受控与非受控同一条路径）
const selectedKeys = defineModel<string[]>('selectedKeys', { default: () => [] })
const selectedSet = computed(() => new Set(selectedKeys.value))

// 父项展开态：纵向允许多组同时展开；横向互斥（同时只浮出一组，如 menubar）
const openKeys = ref<string[]>([])
const isOpen = (key: string): boolean => openKeys.value.includes(key)

const childrenOf = (item: MenuItem): MenuItem[] => item.children ?? []

const rowOf = (item: MenuItem, depth: number, parentKey: string | null): MenuRow => ({
  item,
  key: item.key,
  depth,
  parentKey,
  hasChildren: childrenOf(item).length > 0,
  expanded: childrenOf(item).length > 0 && isOpen(item.key),
})

/** 纵向可见行：父项展开时子级内联在其后（同 OsTree 的平铺做法） */
const flatRows = computed<MenuRow[]>(() => {
  const out: MenuRow[] = []
  const walk = (list: MenuItem[], depth: number, parentKey: string | null) => {
    for (const item of list) {
      out.push(rowOf(item, depth, parentKey))
      if (depth === 1 && childrenOf(item).length > 0 && isOpen(item.key)) {
        walk(childrenOf(item), 2, item.key)
      }
    }
  }
  walk(props.items, 1, null)
  return out
})

/** 横向顶层行 */
const topRows = computed<MenuRow[]>(() => props.items.map((item) => rowOf(item, 1, null)))

/** 横向当前浮出的子菜单行 */
const panelRows = computed<MenuRow[]>(() => {
  const parent = props.items.find((item) => item.key === openKeys.value[0])
  return parent ? childrenOf(parent).map((child) => rowOf(child, 2, parent.key)) : []
})

const activeKey = ref<string | null>(null)
const itemRefs = new Map<string, HTMLElement>()

function setItemRef(key: string, el: unknown) {
  if (el instanceof HTMLElement) itemRefs.set(key, el)
  else itemRefs.delete(key)
}

const visibleKeys = computed(() =>
  props.mode === 'vertical'
    ? flatRows.value.map((r) => r.key)
    : [...topRows.value.map((r) => r.key), ...panelRows.value.map((r) => r.key)],
)

const focusableKey = computed(() =>
  visibleKeys.value.includes(activeKey.value ?? '')
    ? activeKey.value
    : (visibleKeys.value[0] ?? null),
)
const tabIndexFor = (key: string): number => (key === focusableKey.value ? 0 : -1)

function focusKey(key: string) {
  activeKey.value = key
  void nextTick(() => itemRefs.get(key)?.focus())
}

function moveActive(from: MenuRow, delta: number, list: MenuRow[]) {
  const idx = list.findIndex((r) => r.key === from.key)
  const target = list[idx + delta]
  if (target) focusKey(target.key)
}

function select(item: MenuItem) {
  if (item.disabled) return
  if (!selectedKeys.value.includes(item.key)) selectedKeys.value = [item.key]
  emit('click', item.key)
  if (props.mode === 'horizontal') openKeys.value = []
}

function toggleOpen(key: string) {
  openKeys.value =
    props.mode === 'horizontal'
      ? isOpen(key)
        ? []
        : [key]
      : isOpen(key)
        ? openKeys.value.filter((k) => k !== key)
        : [...openKeys.value, key]
}

function onItemClick(row: MenuRow) {
  if (row.item.disabled) return
  if (row.hasChildren) toggleOpen(row.key)
  else select(row.item)
}

function onItemKeydown(event: KeyboardEvent, row: MenuRow) {
  const { key } = event
  if (props.mode === 'vertical') {
    switch (key) {
      case 'ArrowDown':
        event.preventDefault()
        moveActive(row, 1, flatRows.value)
        break
      case 'ArrowUp':
        event.preventDefault()
        moveActive(row, -1, flatRows.value)
        break
      case 'ArrowRight':
        event.preventDefault()
        // disabled 父项不可通过键盘展开（激活唯一入口是 onItemClick，已挡住）
        if (row.item.disabled) break
        if (row.hasChildren && !row.expanded) toggleOpen(row.key)
        else if (row.hasChildren) {
          const child = rowOfChildren(row)[0]
          if (child) focusKey(child.key)
        }
        break
      case 'ArrowLeft':
        event.preventDefault()
        if (row.expanded) toggleOpen(row.key)
        else if (row.parentKey) focusKey(row.parentKey)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        onItemClick(row)
        break
    }
    return
  }

  // horizontal：顶层左右换组，子级上下浏览；展开组内的左右键也落到顶层序列（menubar 惯例）
  if (row.depth === 1) {
    const wasOpen = panelRows.value.length > 0
    switch (key) {
      case 'ArrowRight':
      case 'ArrowLeft': {
        event.preventDefault()
        const delta = key === 'ArrowRight' ? 1 : -1
        const idx = topRows.value.findIndex((r) => r.key === row.key)
        const target = topRows.value[idx + delta]
        if (target) {
          openKeys.value = wasOpen && target.hasChildren ? [target.key] : []
          focusKey(target.key)
        } else if (wasOpen) openKeys.value = []
        break
      }
      case 'ArrowDown':
        event.preventDefault()
        if (row.hasChildren) {
          if (!isOpen(row.key)) toggleOpen(row.key)
          const child = rowOfChildren(row)[0]
          if (child) focusKey(child.key)
        }
        break
      case 'ArrowUp':
        event.preventDefault()
        if (row.hasChildren && isOpen(row.key)) {
          const kids = rowOfChildren(row)
          const last = kids[kids.length - 1]
          if (last) focusKey(last.key)
        }
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        onItemClick(row)
        break
      case 'Escape':
        if (isOpen(row.key)) {
          event.preventDefault()
          toggleOpen(row.key)
        }
        break
    }
    return
  }

  // 横向子级行：上回父项/进同级、下进同级、Escape 收组回父项
  const siblings = panelRows.value
  switch (key) {
    case 'ArrowUp': {
      event.preventDefault()
      const idx = siblings.findIndex((r) => r.key === row.key)
      if (idx <= 0) focusKey(row.parentKey ?? '')
      else focusKey(siblings[idx - 1].key)
      break
    }
    case 'ArrowDown':
      event.preventDefault()
      moveActive(row, 1, siblings)
      break
    case 'Escape':
      event.preventDefault()
      if (row.parentKey) {
        openKeys.value = []
        focusKey(row.parentKey)
      }
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      select(row.item)
      break
  }
}

function rowOfChildren(row: MenuRow): MenuRow[] {
  return props.mode === 'vertical'
    ? flatRows.value.filter((r) => r.parentKey === row.key)
    : panelRows.value
}

/** 选中/危险/禁用态的配色唯一推导处：danger 优先于 accent，二者不叠加避免同属性冲突 */
function toneClass(row: MenuRow): string {
  if (row.item.danger)
    return selectedSet.value.has(row.key)
      ? 'bg-danger-bg text-danger-text'
      : 'text-danger-text hover:bg-surface-hover'
  return selectedSet.value.has(row.key)
    ? 'bg-accent-bg text-accent-text'
    : 'text-ink hover:bg-surface-hover'
}

function itemClass(row: MenuRow): string[] {
  return [
    'flex h-control w-full items-center gap-xs rounded-control px-sm text-left text-ui transition duration-quick',
    row.depth === 2 ? 'ps-lg' : '',
    toneClass(row),
    row.item.disabled ? 'is-disabled' : '',
  ]
}

function chevronClass(row: MenuRow): string {
  if (row.expanded) return 'rotate-180'
  return props.mode === 'vertical' ? '-rotate-90' : ''
}

/** 供 OsDropdown 等浮层宿主使用：打开时把焦点送进首个可见条目 */
function focusFirst() {
  const first = visibleKeys.value[0]
  if (first) focusKey(first)
}

defineExpose({ focusFirst })
</script>

<template>
  <div v-if="mode === 'vertical'" role="menu" class="flex flex-col gap-2xs text-ui">
    <button
      v-for="row in flatRows"
      :key="row.key"
      :ref="(el) => setItemRef(row.key, el)"
      type="button"
      role="menuitem"
      :tabindex="tabIndexFor(row.key)"
      :aria-disabled="row.item.disabled || undefined"
      :aria-haspopup="row.hasChildren ? 'true' : undefined"
      :aria-expanded="row.hasChildren ? row.expanded : undefined"
      :class="itemClass(row)"
      @click="onItemClick(row)"
      @focus="activeKey = row.key"
      @keydown="onItemKeydown($event, row)"
    >
      <OsIcon v-if="row.item.icon" :name="row.item.icon" :size="14" class="shrink-0" />
      <span class="min-w-0 flex-1 truncate">{{ row.item.label }}</span>
      <OsIcon
        v-if="row.hasChildren"
        name="chevron-down"
        :size="12"
        class="shrink-0 text-ink-mute transition-transform duration-quick"
        :class="chevronClass(row)"
      />
    </button>
  </div>

  <div v-else role="menu" class="flex items-center gap-2xs text-ui">
    <div v-for="row in topRows" :key="row.key" class="relative w-auto">
      <button
        :ref="(el) => setItemRef(row.key, el)"
        type="button"
        role="menuitem"
        :tabindex="tabIndexFor(row.key)"
        :aria-disabled="row.item.disabled || undefined"
        :aria-haspopup="row.hasChildren ? 'true' : undefined"
        :aria-expanded="row.hasChildren ? row.expanded : undefined"
        :class="itemClass(row)"
        @click="onItemClick(row)"
        @focus="activeKey = row.key"
        @keydown="onItemKeydown($event, row)"
      >
        <OsIcon v-if="row.item.icon" :name="row.item.icon" :size="14" class="shrink-0" />
        <span class="min-w-0 flex-1 truncate">{{ row.item.label }}</span>
        <OsIcon
          v-if="row.hasChildren"
          name="chevron-down"
          :size="12"
          class="shrink-0 text-ink-mute transition-transform duration-quick"
          :class="chevronClass(row)"
        />
      </button>
      <div
        v-if="row.expanded"
        class="absolute left-0 top-full z-panel mt-2xs flex min-w-44 flex-col gap-2xs rounded-surface border border-line bg-surface p-2xs shadow-pop"
        @click.stop
      >
        <button
          v-for="child in panelRows"
          :key="child.key"
          :ref="(el) => setItemRef(child.key, el)"
          type="button"
          role="menuitem"
          :tabindex="tabIndexFor(child.key)"
          :aria-disabled="child.item.disabled || undefined"
          :class="itemClass(child)"
          @click="select(child.item)"
          @focus="activeKey = child.key"
          @keydown="onItemKeydown($event, child)"
        >
          <OsIcon v-if="child.item.icon" :name="child.item.icon" :size="14" class="shrink-0" />
          <span class="min-w-0 flex-1 truncate">{{ child.item.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
