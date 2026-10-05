<script setup lang="ts">
import { useText } from './internal/text'
import OsIcon from '@/components/OsIcon.vue'
import type { IconName } from '@/kernel/icons'

withDefaults(
  defineProps<{
    /** 顶部图标（固定 34px、弱化墨色），缺省 boxes */
    icon?: IconName
    /** 描述文字，空串回退 common.empty；自定义操作走 action 具名插槽 */
    description?: string
  }>(),
  { icon: 'boxes', description: '' },
)

const { t } = useText()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 py-10 text-center">
    <OsIcon :name="icon" :size="34" class="text-ink-mute/60" />
    <p class="text-ui text-ink-mute">{{ description || t('common.empty') }}</p>
    <!-- 逃生口：自定义操作区（如「新建」按钮） -->
    <div class="mt-1">
      <slot name="action" />
    </div>
  </div>
</template>
