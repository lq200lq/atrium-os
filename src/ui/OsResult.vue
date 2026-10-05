<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import type { IconName } from '@/kernel/icons'
import type { ResultStatus } from './types'

export type { ResultStatus } from './types'

interface ResultConfig {
  icon: IconName
  tint: string
  titleKey: string
  subtitleKey: string
}

// 403 型承接 S2 鉴权拒绝：kernel 目前只在通知中心留痕（session.canAccessApp），
// 本件是它的落地表现层——「去设置」出口经 extra 插槽由调用方接线（gallery 演示），
// 不在组件内触碰鉴权逻辑本身。
const CONFIG: Record<ResultStatus, ResultConfig> = {
  success: {
    icon: 'check',
    tint: 'bg-success-bg text-success-text',
    titleKey: 'result.success.title',
    subtitleKey: 'result.success.subtitle',
  },
  error: {
    icon: 'x',
    tint: 'bg-danger-bg text-danger-text',
    titleKey: 'result.error.title',
    subtitleKey: 'result.error.subtitle',
  },
  '403': {
    icon: 'shield',
    tint: 'bg-warning-bg text-warning-text',
    titleKey: 'result.forbidden.title',
    subtitleKey: 'result.forbidden.subtitle',
  },
  warning: {
    icon: 'alert-triangle',
    tint: 'bg-warning-bg text-warning-text',
    titleKey: 'result.warning.title',
    subtitleKey: 'result.warning.subtitle',
  },
}

const props = withDefaults(
  defineProps<{
    status?: ResultStatus
    title?: string
    subtitle?: string
  }>(),
  { status: 'success', title: '', subtitle: '' },
)

const { t } = useI18n()
const config = computed(() => CONFIG[props.status])
</script>

<template>
  <div role="status" class="flex flex-col items-center gap-sm px-md py-2xl text-center">
    <span
      class="flex aspect-square h-2xl w-2xl items-center justify-center rounded-full"
      :class="config.tint"
    >
      <slot name="icon">
        <OsIcon :name="config.icon" :size="24" />
      </slot>
    </span>
    <div>
      <p class="text-heading-1 font-strong text-ink">{{ title || t(config.titleKey) }}</p>
      <p class="mt-2xs text-ui leading-body text-ink-mute">
        {{ subtitle || t(config.subtitleKey) }}
      </p>
    </div>
    <!-- 补充内容区：失败项摘要 / 提示；操作区：下一步出口（如「重试」「去设置」） -->
    <div
      v-if="$slots.default"
      class="mt-xs w-full max-w-lg rounded-surface bg-fill-quaternary p-md text-left text-ui leading-body text-ink"
    >
      <slot />
    </div>
    <div v-if="$slots.extra" class="mt-xs flex flex-wrap items-center justify-center gap-xs">
      <slot name="extra" />
    </div>
  </div>
</template>
