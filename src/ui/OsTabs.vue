<script setup lang="ts">
import type { TabItem } from './types'

export type { TabItem } from './types'

defineProps<{ tabs: TabItem[] }>()
const active = defineModel<string>({ required: true })
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex shrink-0 items-center gap-1 border-b border-line px-2" role="tablist">
      <button
        v-for="t in tabs"
        :key="t.key"
        role="tab"
        :aria-selected="active === t.key"
        class="relative px-3 py-2 text-ui transition"
        :class="active === t.key ? 'text-accent-strong' : 'text-ink-mute hover:text-ink'"
        @click="active = t.key"
      >
        {{ t.label }}
        <span
          v-if="active === t.key"
          class="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
        />
      </button>
      <!-- 逃生口：页签栏右侧附加内容（如操作按钮） -->
      <div class="ml-auto">
        <slot name="extra" />
      </div>
    </div>
    <div class="min-h-0 flex-1 overflow-auto">
      <!-- 内容区：默认作用域插槽回传当前 active，或用具名插槽 tab-<key> -->
      <slot :active="active">
        <slot :name="`tab-${active}`" />
      </slot>
    </div>
  </div>
</template>
