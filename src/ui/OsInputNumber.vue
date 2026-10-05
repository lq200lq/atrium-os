<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useText } from './internal/text'
import OsIcon from '@/components/OsIcon.vue'
import type { Size, Status } from './types'
import ControlShell from './internal/ControlShell.vue'

const props = withDefaults(
  defineProps<{
    /** 步进量：↑/↓ 方向键与右侧上下钮共用；步进内部 toPrecision(12) 抹浮点尾差 */
    step?: number
    /** 数值下界：提交与步进时钳制，到界时下钮禁用 */
    min?: number
    /** 数值上界：提交与步进时钳制，到界时上钮禁用 */
    max?: number
    /** 显示与提交值保留的小数位 */
    precision?: number
    /** 占位文字 */
    placeholder?: string
    /** 可访问名称：优先级 aria-label prop > placeholder > i18n 缺省文案（common.edit）——与 OsSelect 的 ariaLabel 同一契约 */
    ariaLabel?: string
    /** 高度/内边距走控件刻度（ControlShell）；缺省可被 OsConfigProvider 的 size 覆盖 */
    size?: Size
    /** 禁用输入、上下钮与步进键，同时落原生 disabled */
    disabled?: boolean
    /** 与 OsInput 同一组语义刻度描边/状态环 */
    status?: Status
  }>(),
  {
    step: 1,
    min: undefined,
    max: undefined,
    precision: undefined,
    placeholder: '',
    ariaLabel: undefined,
    size: undefined,
    disabled: false,
    status: 'default',
  },
)

const model = defineModel<number | undefined>()
const { t } = useText()

/** 可访问名一处决议：调用方名字 > 占位即语义 > 内建缺省（i18n，绝不硬编码中文） */
const accessibleName = computed(() => props.ariaLabel || props.placeholder || t('common.edit'))

const format = (v: number | undefined): string =>
  v === undefined ? '' : props.precision !== undefined ? v.toFixed(props.precision) : String(v)

const text = ref(format(model.value))
watch(model, (v) => {
  text.value = format(v)
})

function clamp(v: number): number {
  let out = v
  if (props.min !== undefined) out = Math.max(props.min, out)
  if (props.max !== undefined) out = Math.min(props.max, out)
  return props.precision !== undefined ? Number(out.toFixed(props.precision)) : out
}

function parse(raw: string): number | undefined {
  const n = Number(raw)
  return raw.trim() !== '' && Number.isFinite(n) ? n : undefined
}

const current = computed(() => parse(text.value) ?? model.value ?? 0)
const atMax = computed(() => props.max !== undefined && current.value >= props.max)
const atMin = computed(() => props.min !== undefined && current.value <= props.min)

function commit() {
  const n = parse(text.value)
  if (n === undefined) {
    if (text.value.trim() === '') model.value = undefined
    else text.value = format(model.value)
    return
  }
  model.value = clamp(n)
  text.value = format(model.value)
}

function stepBy(dir: number) {
  if (props.disabled) return
  // toPrecision 抹掉 0.1+0.2 这类二进制浮点尾差，再按 precision 收口
  model.value = clamp(Number((current.value + dir * props.step).toPrecision(12)))
}
</script>

<template>
  <ControlShell :size="size" :status="status" :disabled="disabled">
    <input
      v-model="text"
      type="text"
      inputmode="decimal"
      role="spinbutton"
      :aria-valuenow="model"
      :aria-valuemin="props.min"
      :aria-valuemax="props.max"
      :aria-label="accessibleName"
      :placeholder="placeholder"
      :disabled="disabled"
      class="min-w-0 flex-1 bg-transparent text-ui text-ink"
      @change="commit"
      @blur="commit"
      @keydown.up.prevent="stepBy(1)"
      @keydown.down.prevent="stepBy(-1)"
    />
    <div class="ml-auto flex shrink-0 flex-col self-stretch border-l border-line">
      <button
        type="button"
        :aria-label="t('common.increase')"
        class="flex min-h-0 flex-1 items-center text-ink-mute transition duration-quick hover:text-ink disabled:is-disabled"
        :disabled="disabled || atMax"
        @click="stepBy(1)"
      >
        <OsIcon name="chevron-down" :size="12" class="rotate-180" />
      </button>
      <button
        type="button"
        :aria-label="t('common.decrease')"
        class="flex min-h-0 flex-1 items-center border-t border-line text-ink-mute transition duration-quick hover:text-ink disabled:is-disabled"
        :disabled="disabled || atMin"
        @click="stepBy(-1)"
      >
        <OsIcon name="chevron-down" :size="12" />
      </button>
    </div>
  </ControlShell>
</template>
