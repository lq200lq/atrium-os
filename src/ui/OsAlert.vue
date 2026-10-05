<script setup lang="ts">
import { useText } from './internal/text'
import OsIcon from '@/components/OsIcon.vue'
import type { IconName } from '@/kernel/icons'
import type { BadgeStatus } from './types'
import { LEVEL_ICON, LEVEL_TINT } from './internal/level'

export type { BadgeStatus } from './types'

// 四档语义色与图标取自 internal/level 唯一映射表；default 是 OsAlert 独有的中性档
const TINT_CLASS: Record<BadgeStatus, string> = {
  default: 'border-line bg-fill-quaternary text-ink',
  ...LEVEL_TINT,
}

const ICON_BY_TYPE: Record<BadgeStatus, IconName> = {
  default: 'info',
  ...LEVEL_ICON,
}

withDefaults(
  defineProps<{
    type?: BadgeStatus
    message?: string
    description?: string
    closable?: boolean
    showIcon?: boolean
    /** banner 型：更强的警示语义，aria role 取 alert（非 banner 为被动 status） */
    banner?: boolean
  }>(),
  { type: 'info', message: '', description: '', closable: false, showIcon: true, banner: false },
)

const emit = defineEmits<{ close: [] }>()
const { t } = useText()
</script>

<template>
  <div
    :role="banner ? 'alert' : 'status'"
    class="flex items-start gap-xs rounded-surface border px-sm py-xs text-ui leading-body"
    :class="TINT_CLASS[type]"
  >
    <OsIcon v-if="showIcon" :name="ICON_BY_TYPE[type]" :size="16" class="mt-2xs shrink-0" />
    <div class="min-w-0 flex-1">
      <p v-if="message" class="font-strong">{{ message }}</p>
      <p v-if="description || $slots.default" class="text-caption leading-body">
        <slot>{{ description }}</slot>
      </p>
    </div>
    <div v-if="$slots.action" class="shrink-0 self-center">
      <slot name="action" />
    </div>
    <button
      v-if="closable"
      type="button"
      :aria-label="t('common.close')"
      class="-mr-2xs shrink-0 self-start rounded-chip p-2xs transition duration-quick hover:bg-fill-secondary"
      @click="emit('close')"
    >
      <OsIcon name="x" :size="12" />
    </button>
  </div>
</template>
