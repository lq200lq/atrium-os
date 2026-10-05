<script setup lang="ts">
import { computed, useId } from 'vue'
import OsIcon from '@/components/OsIcon.vue'
import type { CollapseItem } from './types'

export type { CollapseItem } from './types'

const props = withDefaults(
  defineProps<{
    /** 面板定义；标题/内容可分别经 `header-<key>`、`panel-<key>` 具名插槽覆盖 */
    items: CollapseItem[]
    /** true 时同时只展开一项 */
    accordion?: boolean
  }>(),
  { accordion: false },
)

// 未绑定 v-model 时 defineModel 自动退化为内部状态（非受控用法）
const activeKeys = defineModel<string[]>({ default: () => [] })

const uid = useId()
const isOpen = (key: string) => activeKeys.value.includes(key)

const activeSet = computed(() => new Set(activeKeys.value))

function toggle(key: string) {
  if (activeSet.value.has(key)) {
    activeKeys.value = activeKeys.value.filter((k) => k !== key)
  } else {
    activeKeys.value = props.accordion ? [key] : [...activeKeys.value, key]
  }
}
</script>

<template>
  <div class="divide-y divide-line rounded-surface border border-line bg-surface">
    <div v-for="item in items" :key="item.key">
      <button
        :id="`${uid}-header-${item.key}`"
        type="button"
        :aria-expanded="isOpen(item.key)"
        :aria-controls="`${uid}-panel-${item.key}`"
        class="flex w-full items-center gap-xs px-md py-sm text-left text-ui text-ink transition hover:bg-surface-hover"
        @click="toggle(item.key)"
      >
        <OsIcon
          name="chevron-down"
          :size="14"
          class="shrink-0 text-ink-mute transition-transform duration-quick"
          :class="isOpen(item.key) && 'rotate-180'"
        />
        <slot :name="`header-${item.key}`" :item="item">{{ item.header }}</slot>
      </button>
      <div
        v-show="isOpen(item.key)"
        :id="`${uid}-panel-${item.key}`"
        role="region"
        :aria-labelledby="`${uid}-header-${item.key}`"
        class="px-md pb-sm text-ui leading-body text-ink"
      >
        <slot :name="`panel-${item.key}`" :item="item" />
      </div>
    </div>
  </div>
</template>
