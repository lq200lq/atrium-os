<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useText } from './internal/text'
import type { Size, Status, TextareaAutosize } from './types'
import { controlPaddingClass, controlStatusClass } from './internal/control'
import { useControlSize } from './config'

// 多行控件的高度属于 rows/autosize 语义，size 档在此只驱动内边距刻度（§3.4 控件高表仅列 Button/Input/Select）
const props = withDefaults(
  defineProps<{
    /** 初始行数；开 autosize 时充当高度下界（minRows 缺省回落到 rows） */
    rows?: number
    /** 自适应高度：硬换行按行数立即生效，软换行由渲染后实测 scrollHeight 修正；对象形态给 minRows/maxRows 边界 */
    autosize?: boolean | TextareaAutosize
    /** 右下角字数；不传但给了 maxLength 时同样显示（n / max 形式） */
    showCount?: boolean
    /** 原生 maxlength 硬上限；提供即强制显示字数（见 showCount） */
    maxLength?: number
    /** 占位文字 */
    placeholder?: string
    /** 可访问名称：优先级 aria-label prop > placeholder > i18n 缺省文案（common.edit）——与 OsSelect 的 ariaLabel 同一契约 */
    ariaLabel?: string
    /** 只驱动内边距刻度；多行件高度属于 rows/autosize 语义，不进控件高表。缺省跟随作用域（OsConfigProvider） */
    size?: Size
    /** is-disabled 唯一写法；同时落原生 disabled */
    disabled?: boolean
    /** error/warning 描边 + 状态环，default 走中性描边 */
    status?: Status
  }>(),
  {
    rows: 3,
    autosize: false,
    showCount: false,
    maxLength: undefined,
    placeholder: '',
    ariaLabel: undefined,
    size: undefined,
    disabled: false,
    status: 'default',
  },
)

const model = defineModel<string>({ default: '' })
const scale = useControlSize(() => props.size)
const { t } = useText()
const taRef = ref<HTMLTextAreaElement | null>(null)

/** 可访问名一处决议：调用方名字 > 占位即语义 > 内建缺省（i18n，绝不硬编码中文） */
const accessibleName = computed(() => props.ariaLabel || props.placeholder || t('common.edit'))

const bounds = computed(() => {
  if (!props.autosize) return null
  const opt: TextareaAutosize = typeof props.autosize === 'object' ? props.autosize : {}
  return { min: opt.minRows ?? props.rows, max: opt.maxRows }
})

// 硬换行数决定 rows（可在无布局环境验证）；软换行高度由渲染后实测 scrollHeight 修正
const effectiveRows = computed(() => {
  const b = bounds.value
  if (!b) return props.rows
  const lines = model.value.split('\n').length
  return Math.max(b.min, Math.min(b.max ?? lines, lines))
})

const countText = computed(() =>
  props.maxLength !== undefined
    ? `${model.value.length} / ${props.maxLength}`
    : String(model.value.length),
)

function remeasure() {
  const el = taRef.value
  const b = bounds.value
  if (!el || !b) return
  el.style.height = 'auto'
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight)
  if (!lineHeight) return
  const max = b.max ? b.max * lineHeight : Infinity
  el.style.height = `${Math.min(Math.max(el.scrollHeight, b.min * lineHeight), max)}px`
}

watch([model, effectiveRows], () => {
  void nextTick(remeasure)
})
onMounted(remeasure)
</script>

<template>
  <div class="text-ui">
    <div
      class="rounded-control border py-xs transition"
      :class="[controlPaddingClass(scale), controlStatusClass(status), disabled && 'is-disabled']"
    >
      <textarea
        ref="taRef"
        v-model="model"
        :rows="effectiveRows"
        :placeholder="placeholder"
        :aria-label="accessibleName"
        :maxlength="maxLength"
        :disabled="disabled"
        class="block w-full resize-none bg-transparent text-ui text-ink"
      />
    </div>
    <p
      v-if="showCount || maxLength !== undefined"
      class="mt-2xs text-right text-caption text-ink-mute"
    >
      {{ countText }}
    </p>
  </div>
</template>
