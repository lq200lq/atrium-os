<script setup lang="ts">
import { ref } from 'vue'
import OsIcon from '@/components/OsIcon.vue'
import { useControlSize } from './config'
import type { SegmentedOption, Size } from './types'
import { controlHeightClass } from './internal/control'

export type { SegmentedOption } from './types'

const props = withDefaults(
  defineProps<{
    /** 分段定义（value/label/icon）；icon 为可选项，缺省该段只渲染 label */
    options: SegmentedOption[]
    /** 可访问名：radiogroup 缺少可见标题时必传 */
    label?: string
    /** 段高走 h-control-* 刻度；字号/内边距不随档变化；缺省可被 OsConfigProvider 的 size 覆盖 */
    size?: Size
    /** 整组禁用：各段原生 disabled，方向键导航同时失效 */
    disabled?: boolean
    /** true 时铺满容器，各段等宽 */
    block?: boolean
  }>(),
  { label: '', size: undefined, disabled: false, block: false },
)

const resolvedSize = useControlSize(() => props.size)

const model = defineModel<string>({ required: true })
const group = ref<HTMLElement | null>(null)

function select(value: string) {
  if (!props.disabled) model.value = value
}

// 方向键在 radio 语义下「选中即移动焦点」，与 OsRadio 组一致
function onKeydown(event: KeyboardEvent) {
  if (props.disabled) return
  const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']
  if (!keys.includes(event.key)) return
  event.preventDefault()
  const values = props.options.map((o) => o.value)
  const current = Math.max(0, values.indexOf(model.value))
  const last = values.length - 1
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? last
        : event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? (current + 1) % values.length
          : (current - 1 + values.length) % values.length
  select(values[next])
  group.value?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
}
</script>

<template>
  <div
    ref="group"
    role="radiogroup"
    :aria-label="label || undefined"
    :aria-disabled="disabled || undefined"
    class="inline-flex items-center gap-2xs rounded-control bg-fill p-2xs"
    :class="[block && 'flex w-full', disabled && 'is-disabled']"
    @keydown="onKeydown"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      :tabindex="disabled ? -1 : model === option.value ? 0 : -1"
      :disabled="disabled"
      class="flex items-center justify-center gap-2xs whitespace-nowrap rounded-control px-sm text-ui transition duration-quick"
      :class="[
        controlHeightClass(resolvedSize),
        block && 'flex-1',
        model === option.value
          ? 'bg-surface text-ink shadow-raise'
          : 'text-ink-mute hover:text-ink',
      ]"
      @click="select(option.value)"
    >
      <slot name="option-prefix" :option="option" />
      <OsIcon v-if="option.icon" :name="option.icon" :size="14" />
      {{ option.label }}
    </button>
  </div>
</template>
