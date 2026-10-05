<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useText } from './internal/text'
import OsButton from './OsButton.vue'

const props = withDefaults(
  defineProps<{
    /** 标题文字（必填，无 i18n 回退）；同时作为对话框的 aria-label。退出通道：cancel/confirm 按钮 + Esc，由父级据事件收敛；关闭后焦点自动回触发元素（S12 键盘契约） */
    title: string
    /** 确认按钮文案，空串回退 common.confirm */
    confirmText?: string
    /** 取消按钮文案，空串回退 common.cancel */
    cancelText?: string
    /** 确认按钮 loading 态：提交中由调用方置 true */
    loading?: boolean
    /** true 时 pointerdown 落在遮罩（非内容区）也派发 cancel；false 则仅按钮可退出 */
    maskClosable?: boolean
  }>(),
  { confirmText: '', cancelText: '', loading: false, maskClosable: true },
)
const emit = defineEmits<{
  /** 点击确认按钮派发；组件不会自行关闭，由父级据事件收敛 */
  confirm: []
  /** 点击取消按钮派发；maskClosable 为 true 时点遮罩同样派发 */
  cancel: []
}>()
const { t } = useText()

function onMaskClick() {
  if (props.maskClosable) emit('cancel')
}

/** 键盘退出契约（S12）：Esc 等同取消；关闭后焦点还给打开它的触发元素 */
let opener: HTMLElement | null = null

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('cancel')
}

onMounted(() => {
  const el = document.activeElement
  opener = el instanceof HTMLElement && el !== document.body ? el : null
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (opener?.isConnected) opener.focus()
})
</script>

<template>
  <div
    class="absolute inset-0 z-float flex items-center justify-center bg-scrim"
    @pointerdown.self="onMaskClick"
  >
    <div
      class="w-72 rounded-surface bg-surface p-md shadow-pop"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
    >
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
