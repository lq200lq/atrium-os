<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import type { IconName } from '@/kernel/icons'

withDefaults(
  defineProps<{
    icon?: IconName
    description?: string
  }>(),
  { icon: 'boxes', description: '' },
)

const { t } = useI18n()
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
