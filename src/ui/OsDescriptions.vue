<script setup lang="ts">
import type { DescriptionItem } from './types'

export type { DescriptionItem } from './types'

withDefaults(
  defineProps<{
    items: DescriptionItem[]
    title?: string
    /** 宽窗口下的列数（窄窗口恒为 1 列） */
    column?: 1 | 2
  }>(),
  { title: '', column: 1 },
)
</script>

<template>
  <section class="min-w-0">
    <h4 v-if="title" class="mb-xs text-heading-3 font-strong text-ink">{{ title }}</h4>
    <dl class="grid gap-x-lg gap-y-2xs" :class="column === 2 && 'w-mid:grid-cols-2'">
      <div v-for="item in items" :key="item.key" class="flex min-w-0 items-baseline gap-sm py-2xs">
        <dt class="shrink-0 text-caption text-ink-mute">{{ item.label }}</dt>
        <dd class="min-w-0 flex-1 text-ui leading-body text-ink">
          <!-- 逃生口：item.slot 指定具名插槽自定义值 -->
          <slot :name="item.slot ?? `value-${item.key}`" :item="item">{{ item.value }}</slot>
        </dd>
      </div>
    </dl>
  </section>
</template>
