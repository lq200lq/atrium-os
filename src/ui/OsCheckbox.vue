<script setup lang="ts">
import type { Status } from './types'
import { controlStatusClass } from './internal/control'

withDefaults(
  defineProps<{
    /** 落原生 disabled，勾选框与 label 文本一并失效 */
    disabled?: boolean
    /** 相邻文案；input 可被 label 关联，点击文本等同勾选切换 */
    label?: string
    /** 可访问名称：label 缺省（纯图标/自定义排布场景）时给 input 显式命名，优先级最高 */
    ariaLabel?: string
    /** 非 default 时给勾选框加语义描边 + 状态环 */
    status?: Status
  }>(),
  { disabled: false, label: '', ariaLabel: undefined, status: 'default' },
)
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <label class="inline-flex items-center gap-2 text-ui text-ink" :class="disabled && 'is-disabled'">
    <input
      type="checkbox"
      :checked="model"
      :disabled="disabled"
      :aria-label="ariaLabel"
      class="h-4 w-4 rounded-chip accent-[var(--color-accent)]"
      :class="controlStatusClass(status)"
      @change="model = ($event.target as HTMLInputElement).checked"
    />
    <span v-if="label">{{ label }}</span>
  </label>
</template>
