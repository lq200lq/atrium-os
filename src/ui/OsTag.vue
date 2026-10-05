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
    status?: BadgeStatus
    bordered?: boolean
    closable?: boolean
    icon?: IconName
  }>(),
  { status: 'default', bordered: true, closable: false, icon: undefined },
)

const emit = defineEmits<{ close: [] }>()
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
