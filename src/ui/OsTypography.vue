<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Status, TypographyType } from './types'

export type { TypographyType } from './types'

// 省略行数 → 静态 line-clamp 档（Tailwind 需要字面类名）
const CLAMP: Record<number, string> = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
}

const TYPE_CLASS: Record<TypographyType, string> = {
  text: 'text-ui leading-body',
  title: 'text-heading-3 font-strong',
  paragraph: 'text-ui leading-body',
  link: 'text-ui leading-body hover:underline',
}

const STATUS_CLASS: Record<'error' | 'warning', string> = {
  error: 'text-danger-text',
  warning: 'text-warning-text',
}

const props = withDefaults(
  defineProps<{
    type?: TypographyType
    /** link 型的跳转目标 */
    href?: string
    strong?: boolean
    disabled?: boolean
    status?: Status
    ellipsis?: boolean
    rows?: 1 | 2 | 3 | 4
    /** 省略后追加「展开/收起」切换 */
    expandable?: boolean
  }>(),
  {
    type: 'text',
    href: '',
    strong: false,
    disabled: false,
    status: 'default',
    ellipsis: false,
    rows: 1,
    expandable: false,
  },
)

const { t } = useI18n()
const uid = useId()
const expanded = ref(false)

const tag = computed(() => (props.type === 'link' && props.href ? 'a' : 'p'))
// 颜色单独派生：status 非 default 时覆盖正文色，避免两条 color 工具类打架
const colorClass = computed(() =>
  props.status !== 'default'
    ? STATUS_CLASS[props.status]
    : props.type === 'link'
      ? 'text-accent-text'
      : 'text-ink',
)
const clamped = computed(() => props.ellipsis && !expanded.value)
</script>

<template>
  <div class="min-w-0">
    <component
      :is="tag"
      :id="`${uid}-content`"
      :href="tag === 'a' ? href : undefined"
      class="break-words transition-colors"
      :class="[
        TYPE_CLASS[type],
        colorClass,
        strong && 'font-strong',
        disabled && 'is-disabled',
        clamped && CLAMP[rows],
      ]"
    >
      <slot />
    </component>
    <button
      v-if="ellipsis && expandable"
      type="button"
      class="mt-2xs text-caption text-accent-text transition"
      :aria-expanded="expanded"
      :aria-controls="`${uid}-content`"
      @click="expanded = !expanded"
    >
      {{ expanded ? t('common.collapse') : t('common.expand') }}
    </button>
  </div>
</template>
