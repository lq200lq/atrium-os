<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import type { Size, Status } from './types'
import ControlShell from './internal/ControlShell.vue'

withDefaults(
  defineProps<{
    /** 占位文字 */
    placeholder?: string
    /** 高度/内边距走控件刻度（ControlShell） */
    size?: Size
    /** is-disabled 唯一写法；同时落原生 disabled */
    disabled?: boolean
    /** error/warning 描边 + 状态环，default 走中性描边 */
    status?: Status
    /** 值非空时在后缀区显示 ×，点击清空 v-model 并派发 clear；与 suffix 插槽共存 */
    clearable?: boolean
  }>(),
  { placeholder: '', size: 'md', disabled: false, status: 'default', clearable: false },
)

const model = defineModel<string>({ default: '' })
const emit = defineEmits<{
  /** Enter 键按下时派发（keydown.enter），组件自身不做提交 */
  enter: []
  /** Esc 键按下时派发（keydown.esc） */
  esc: []
  /** 点击 clearable 的 × 时派发；发出前 v-model 已置为空串 */
  clear: []
}>()
const { t } = useI18n()

function onClear() {
  model.value = ''
  emit('clear')
}
</script>

<template>
  <ControlShell :size="size" :status="status" :disabled="disabled">
    <span v-if="$slots.prefix" class="flex shrink-0 items-center text-ink-mute">
      <slot name="prefix" />
    </span>
    <input
      v-model="model"
      :placeholder="placeholder"
      :disabled="disabled"
      class="min-w-0 flex-1 bg-transparent text-ui text-ink"
      @keydown.enter="emit('enter')"
      @keydown.esc="emit('esc')"
    />
    <template #suffix>
      <button
        v-if="clearable && model"
        type="button"
        :aria-label="t('common.clear')"
        class="shrink-0 text-ink-mute transition hover:text-ink"
        @click="onClear"
      >
        <OsIcon name="x" :size="14" />
      </button>
      <span v-if="$slots.suffix" class="flex shrink-0 items-center text-ink-mute">
        <slot name="suffix" />
      </span>
    </template>
  </ControlShell>
</template>
