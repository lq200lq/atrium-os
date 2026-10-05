<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import OsButton from './OsButton.vue'

const props = withDefaults(
  defineProps<{
    title: string
    confirmText?: string
    cancelText?: string
    /** 确认按钮 loading 态：提交中由调用方置 true */
    loading?: boolean
    maskClosable?: boolean
  }>(),
  { confirmText: '', cancelText: '', loading: false, maskClosable: true },
)
const emit = defineEmits<{ confirm: []; cancel: [] }>()
const { t } = useI18n()

function onMaskClick() {
  if (props.maskClosable) emit('cancel')
}
</script>

<template>
  <div
    class="absolute inset-0 z-20 flex items-center justify-center bg-scrim"
    @pointerdown.self="onMaskClick"
  >
    <div class="w-72 rounded-surface bg-surface p-md shadow-pop">
      <p class="mb-sm font-strong text-ink">{{ title }}</p>
      <slot />
      <div class="mt-md flex justify-end gap-2">
        <OsButton size="sm" @click="emit('cancel')">{{
          cancelText || t('common.cancel')
        }}</OsButton>
        <OsButton size="sm" variant="primary" :loading="loading" @click="emit('confirm')">{{
          confirmText || t('common.confirm')
        }}</OsButton>
      </div>
    </div>
  </div>
</template>
