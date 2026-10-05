<script setup lang="ts">
import type { Status } from './types'
import { controlStatusClass } from './internal/control'

withDefaults(
  defineProps<{
    /** 禁用切换并落原生 disabled */
    disabled?: boolean
    /** 右侧说明文字；非空才渲染。button 非可标注元素，点击文本不会切换开关 */
    label?: string
    /** 非 default 时给开关本体加语义描边 + 状态环（default 态无描边，与 Input 家族不同） */
    status?: Status
  }>(),
  { disabled: false, label: '', status: 'default' },
)
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <label
    class="inline-flex cursor-pointer items-center gap-2 text-ui text-ink"
    :class="disabled && 'is-disabled'"
  >
    <button
      type="button"
      role="switch"
      :aria-checked="model"
      :disabled="disabled"
      class="relative h-5 w-9 rounded-full transition"
      :class="[model ? 'bg-accent' : 'bg-ink-mute', controlStatusClass(status, false)]"
      @click="!disabled && (model = !model)"
    >
      <span
        class="absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow transition-all"
        :class="model ? 'left-4.5' : 'left-0.5'"
      />
    </button>
    <span v-if="label">{{ label }}</span>
  </label>
</template>
