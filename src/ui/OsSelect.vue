<script setup lang="ts">
import type { SelectOption, Size, Status } from './types'
import ControlShell from './internal/ControlShell.vue'

export type { SelectOption } from './types'

withDefaults(
  defineProps<{
    /** 选项列表（value/label）；空数组时仅剩占位项，不可选 */
    options: SelectOption[]
    /** 非空时渲染为 disabled 占位 option；默认值 '请选择' 是写死的中文、不走 i18n，传空串可关掉 */
    placeholder?: string
    /** 高度/内边距走控件刻度（ControlShell） */
    size?: Size
    /** is-disabled 唯一写法；同时落原生 disabled */
    disabled?: boolean
    /** 后缀区追加旋转 loader 指示；只影响外观，不禁用选择 */
    loading?: boolean
    /** error/warning 描边 + 状态环，default 走中性描边 */
    status?: Status
  }>(),
  { placeholder: '请选择', size: 'md', disabled: false, loading: false, status: 'default' },
)

const model = defineModel<string>({ default: '' })
</script>

<template>
  <ControlShell :size="size" :status="status" :disabled="disabled" :loading="loading" filled>
    <select
      v-model="model"
      :disabled="disabled"
      class="h-full w-full min-w-0 flex-1 bg-transparent text-ui text-ink"
    >
      <option v-if="placeholder" value="" disabled>
        {{ placeholder }}
      </option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
  </ControlShell>
</template>
