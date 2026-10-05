<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useText } from './internal/text'
import OsButton from './OsButton.vue'
import type { Placement } from './types'
import { placementClass } from './internal/placement'

export type { Placement } from './types'

/**
 * 轻确认浮层：替代「为一个小操作开一个 OsDialog」。
 * 层级取 z-panel（浮层族），定位走 S10 placement 原语；不做 viewport 翻转（同原语取舍）。
 */
const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    okText?: string
    cancelText?: string
    placement?: Placement
    disabled?: boolean
  }>(),
  { title: '', description: '', okText: '', cancelText: '', placement: 'bottom', disabled: false },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()
const { t } = useText()

const open = ref(false)
/** 根节点同时是触发容器：tabindex=-1 让关闭后焦点可程序化回到触发元素 */
const root = ref<HTMLElement | null>(null)
const okBtn = ref<InstanceType<typeof OsButton> | null>(null)

function show() {
  if (props.disabled || open.value) return
  open.value = true
  // 可访问性硬要求：打开时焦点进入浮层内确认按钮
  nextTick(() => (okBtn.value?.$el as HTMLElement | undefined)?.focus())
}

function hide() {
  if (!open.value) return
  // 只有焦点仍在触发区/浮层内才回焦：外点关闭时焦点已归给用户点的那个元素，
  // 无条件 focus 会把它抢走（例如点表格行同时收起浮层，行就选不上了）。
  const restore = !!root.value?.contains(document.activeElement)
  open.value = false
  if (restore) nextTick(() => root.value?.focus())
}

function toggle() {
  if (open.value) hide()
  else show()
}

function onConfirm() {
  emit('confirm')
  hide()
}

function onCancel() {
  emit('cancel')
  hide()
}

function onDocPointerdown(event: Event) {
  if (root.value && !root.value.contains(event.target as Node)) hide()
}

// 点外部关闭：监听只在打开期间挂在 document 上，关闭与卸载都必须解绑
watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('pointerdown', onDocPointerdown)
  else document.removeEventListener('pointerdown', onDocPointerdown)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointerdown))
</script>

<template>
  <span ref="root" class="relative inline-flex" tabindex="-1" @click="toggle" @keydown.esc="hide()">
    <slot />
    <div
      v-if="open"
      role="dialog"
      :aria-label="title || t('popconfirm.title')"
      class="absolute z-panel w-64 rounded-surface border border-line bg-surface p-sm text-left shadow-pop"
      :class="placementClass(placement)"
      @click.stop
    >
      <p v-if="title" class="text-ui font-strong leading-body text-ink">{{ title }}</p>
      <p
        v-if="description || $slots.description"
        class="mt-2xs text-caption leading-body text-ink-mute"
      >
        <slot name="description">{{ description }}</slot>
      </p>
      <div class="mt-sm flex justify-end gap-xs">
        <OsButton size="sm" @click="onCancel">{{ cancelText || t('common.cancel') }}</OsButton>
        <OsButton ref="okBtn" size="sm" variant="primary" @click="onConfirm">
          {{ okText || t('common.confirm') }}
        </OsButton>
      </div>
    </div>
  </span>
</template>
