<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import type { IconName } from '@/kernel/icons'
import type { BadgeStatus } from './types'

export type { BadgeStatus } from './types'

// OsTag 只做内容标签（分类/染色词条）；「状态指示」职责在 OsBadge / OsAlert，不在此重叠。
const TINT_CLASS: Record<BadgeStatus, string> = {
  default: 'border-line bg-fill-quaternary text-ink',
  error: 'border-danger-border bg-danger-bg text-danger-text',
  warning: 'border-warning-border bg-warning-bg text-warning-text',
  success: 'border-success-border bg-success-bg text-success-text',
  info: 'border-info-border bg-info-bg text-info-text',
}

withDefaults(
  defineProps<{
    /** 五档预设 tint：描边/浅底/前景同色族（default/error/warning/success/info） */
    status?: BadgeStatus
    /** 关闭描边时改用透明边框占位，盒子尺寸不变 */
    bordered?: boolean
    /** 尾部 × 按钮（10px），aria-label 走 common.close；点击派发 close */
    closable?: boolean
    /** 前置图标（固定 12px），缺省不渲染图标位 */
    icon?: IconName
  }>(),
  { status: 'default', bordered: true, closable: false, icon: undefined },
)

const emit = defineEmits<{
  /** 点击 closable 渲染的尾部 × 时派发；组件自身不负责移除标签 */
  close: []
}>()
const { t } = useI18n()
</script>

<template>
  <span
    class="inline-flex h-5 max-w-full items-center gap-2xs rounded-chip px-xs text-micro"
    :class="[TINT_CLASS[status], bordered ? 'border' : 'border border-transparent']"
  >
    <OsIcon v-if="icon" :name="icon" :size="12" class="shrink-0" />
    <span class="truncate"><slot /></span>
    <button
      v-if="closable"
      type="button"
      :aria-label="t('common.close')"
      class="-mr-2xs shrink-0 rounded-chip p-2xs text-ink-mute transition hover:text-ink"
      @click="emit('close')"
    >
      <OsIcon name="x" :size="10" />
    </button>
  </span>
</template>
