<script setup lang="ts">
import { computed, useId } from 'vue'
import type { RadioOption, Status } from './types'
import { controlStatusClass } from './internal/control'

export type { RadioOption } from './types'

const props = withDefaults(
  defineProps<{
    /** 选项列表；选中项的 value 写回 v-model，label 显示于圆点旁 */
    options: RadioOption[]
    /** 原生 name（浏览器互斥分组）；缺省按实例自动生成唯一组名，同页多组互不串味 */
    name?: string
    /** 整组禁用：每项落原生 disabled，选中不变 */
    disabled?: boolean
    /** 非 default 时每个圆点加语义描边 + 状态环 */
    status?: Status
  }>(),
  { name: undefined, disabled: false, status: 'default' },
)

/** 原生 radio 靠 name 分组，写死同名会让两个独立分组互相取消选中 */
const uid = useId()
const groupName = computed(() => props.name ?? `os-radio-${uid}`)

const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="flex flex-wrap items-center gap-3 text-ui text-ink" role="radiogroup">
    <label
      v-for="opt in options"
      :key="opt.value"
      class="inline-flex items-center gap-xs"
      :class="disabled && 'is-disabled'"
    >
      <input
        type="radio"
        :name="groupName"
        :value="opt.value"
        :checked="model === opt.value"
        :disabled="disabled"
        class="h-4 w-4 accent-[var(--color-accent)]"
        :class="controlStatusClass(status)"
        @change="model = opt.value"
      />
      <span>{{ opt.label }}</span>
    </label>
  </div>
</template>
