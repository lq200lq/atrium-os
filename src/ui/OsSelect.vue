<script setup lang="ts">
import { computed } from 'vue'
import type { SelectOption, Size, Status } from './types'
import ControlShell from './internal/ControlShell.vue'
import { useText } from './internal/text'

export type { SelectOption } from './types'

const props = withDefaults(
  defineProps<{
    /** 选项列表（value/label）；空数组时仅剩占位项，不可选 */
    options: SelectOption[]
    /** 非空时渲染为 disabled 占位 option；缺省取当前语言的 `common.selectPlaceholder`，传空串可关掉 */
    placeholder?: string
    /** 可访问名称：原生 select 没有可见 label，缺省时占位项也不等于给名字 */
    ariaLabel?: string
    /** 高度/内边距走控件刻度（ControlShell），可被 OsConfigProvider 的 size 覆盖 */
    size?: Size
    /** is-disabled 唯一写法；同时落原生 disabled */
    disabled?: boolean
    /** 后缀区追加旋转 loader 指示；只影响外观，不禁用选择 */
    loading?: boolean
    /** error/warning 描边 + 状态环，default 走中性描边 */
    status?: Status
  }>(),
  {
    placeholder: undefined,
    ariaLabel: undefined,
    size: undefined,
    disabled: false,
    loading: false,
    status: 'default',
  },
)

const model = defineModel<string>({ default: '' })

const { t } = useText()
const resolvedPlaceholder = computed(() => props.placeholder ?? t('common.selectPlaceholder'))
</script>

<template>
  <ControlShell :size="size" :status="status" :disabled="disabled" :loading="loading" filled>
    <select
      v-model="model"
      :disabled="disabled"
      :aria-label="ariaLabel ?? resolvedPlaceholder"
      class="h-full w-full min-w-0 flex-1 bg-transparent text-ui text-ink"
    >
      <option v-if="resolvedPlaceholder" value="" disabled>
        {{ resolvedPlaceholder }}
      </option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
  </ControlShell>
</template>
