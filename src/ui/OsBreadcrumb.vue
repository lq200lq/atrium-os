<script setup lang="ts">
import { computed } from 'vue'
import { useText } from './internal/text'
import OsIcon from '@/components/OsIcon.vue'
import OsDropdown from './OsDropdown.vue'
import type { BreadcrumbItem, MenuItem } from './types'

export type { BreadcrumbItem } from './types'

/** 折叠后仍要单独渲染的路径段：普通条目或省略号下拉 */
type Segment = { type: 'item'; item: BreadcrumbItem; current: boolean } | { type: 'overflow' }

const props = withDefaults(
  defineProps<{
    /** 路径条目（顺序即层级）；末项恒为当前页，不可点并带 aria-current="page" */
    items: BreadcrumbItem[]
    /** 层级分隔符；独立 span 渲染（aria-hidden），不混入条目文本 */
    separator?: string
    /** 超过该数量时折叠中间层级（省略号经 OsDropdown 承载）；小于 3 或 0 表示不折叠 */
    maxVisibleItems?: number
  }>(),
  { separator: '/', maxVisibleItems: 0 },
)

const emit = defineEmits<{
  /** 点击非当前页层级（或折叠下拉中被选中的层级）时派发；href 条目同时保留链接跳转 */
  click: [item: BreadcrumbItem]
}>()

const { t } = useText()

const collapsed = computed(
  () => props.maxVisibleItems >= 3 && props.items.length > props.maxVisibleItems,
)

/** 折叠态下被省略的中间层级（下拉里承载的那批） */
const overflowItems = computed<BreadcrumbItem[]>(() => {
  if (!collapsed.value) return []
  const tailCount = props.maxVisibleItems - 2
  return props.items.slice(1, props.items.length - tailCount)
})

const segments = computed<Segment[]>((): Segment[] => {
  const last = props.items.length - 1
  if (!collapsed.value) {
    return props.items.map((item, i) => ({ type: 'item', item, current: i === last }))
  }
  const tailCount = props.maxVisibleItems - 2
  const head = props.items[0]
  const tail = props.items.slice(props.items.length - tailCount)
  return [
    { type: 'item', item: head, current: false },
    { type: 'overflow' },
    ...tail.map((item, i): Segment => ({ type: 'item', item, current: i === tail.length - 1 })),
  ]
})

const overflowMenu = computed<MenuItem[]>(() =>
  overflowItems.value.map((item, i) => ({
    key: String(i),
    label: item.label,
    icon: item.icon,
  })),
)

function onItemClick(item: BreadcrumbItem) {
  emit('click', item)
}

function onOverflowSelect(key: string) {
  const item = overflowItems.value[Number(key)]
  if (item) emit('click', item)
}

/** 条目外观：当前页 muted 不可点，其余可点且有 hover 反馈 */
const CRUMB_BASE =
  'inline-flex max-w-44 items-center gap-2xs truncate rounded-chip px-2xs text-ui transition duration-quick'
const CRUMB_ACTION = `${CRUMB_BASE} text-ink hover:bg-surface-hover`
const CRUMB_CURRENT = `${CRUMB_BASE} text-ink-mute`
</script>

<template>
  <nav :aria-label="t('breadcrumb.aria')" class="flex min-w-0 flex-wrap items-center gap-2xs">
    <template v-for="(seg, i) in segments" :key="i">
      <span v-if="i > 0" class="shrink-0 text-caption text-ink-mute" aria-hidden="true">
        {{ separator }}
      </span>

      <OsDropdown
        v-if="seg.type === 'overflow'"
        :items="overflowMenu"
        placement="bottom-start"
        @click="onOverflowSelect"
      >
        <button type="button" :aria-label="t('breadcrumb.overflow')" :class="CRUMB_ACTION">
          …
        </button>
      </OsDropdown>

      <template v-else>
        <component
          :is="seg.item.href && !seg.current ? 'a' : 'button'"
          :href="seg.item.href && !seg.current ? seg.item.href : undefined"
          :type="seg.item.href && !seg.current ? undefined : 'button'"
          :aria-current="seg.current ? 'page' : undefined"
          :aria-disabled="seg.current ? 'true' : undefined"
          :disabled="seg.current ? true : undefined"
          :class="[seg.current ? CRUMB_CURRENT : CRUMB_ACTION]"
          @click="seg.current ? undefined : onItemClick(seg.item)"
        >
          <OsIcon v-if="seg.item.icon" :name="seg.item.icon" :size="14" class="shrink-0" />
          <span class="truncate">{{ seg.item.label }}</span>
        </component>
      </template>
    </template>
  </nav>
</template>
