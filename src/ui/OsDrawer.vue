<script setup lang="ts">
import { watch } from 'vue'
import { useText } from './internal/text'
import OsIcon from '@/components/OsIcon.vue'

withDefaults(
  defineProps<{
    /** 标题文字；空串时标题行仍渲染（含关闭按钮），不留空白 */
    title?: string
    /** 贴靠侧；滑入轨迹按侧镜像（right 从右推入，left 从左推入） */
    placement?: 'right' | 'left'
    /** 抽屉宽度，直接写进内联 style 的 CSS 长度值（如 '360px'、'40%'） */
    width?: string
  }>(),
  { title: '', placement: 'right', width: '360px' },
)

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{
  /** × 按钮、遮罩点击或 Esc 时派发；先置 v-model 为 false 再发出，关闭后焦点回触发元素 */
  close: []
}>()
const { t } = useText()

function close() {
  open.value = false
  emit('close')
}

/** 键盘退出契约（S12，与 OsDialog 同口径）：Esc 等同关闭；关闭后焦点还给打开它的触发元素 */
let opener: HTMLElement | null = null

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch(
  open,
  (v) => {
    if (v) {
      const el = document.activeElement
      opener = el instanceof HTMLElement && el !== document.body ? el : null
      window.addEventListener('keydown', onKeydown)
    } else {
      window.removeEventListener('keydown', onKeydown)
      if (opener?.isConnected) opener.focus()
      opener = null
    }
  },
  { immediate: true },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="open" class="fixed inset-0 z-float bg-scrim" @pointerdown.self="close">
        <Transition name="drawer-slide">
          <aside
            v-if="open"
            class="absolute top-0 flex h-full flex-col border-glass-border-active bg-glass-pop shadow-pop backdrop-blur-xl"
            :class="[
              placement === 'right' ? 'right-0 border-l' : 'left-0 border-r slide-from-left',
            ]"
            :style="{ width }"
            role="dialog"
            aria-modal="true"
          >
            <header
              class="flex h-11 shrink-0 items-center justify-between border-b border-line px-md"
            >
              <span class="text-title font-strong text-ink">{{ title }}</span>
              <button
                class="text-ink-mute hover:text-ink"
                :title="t('common.close')"
                @click="close"
              >
                <OsIcon name="x" :size="16" />
              </button>
            </header>
            <div class="min-h-0 flex-1 overflow-y-auto p-md text-ui text-ink">
              <slot />
            </div>
            <footer v-if="$slots.footer" class="shrink-0 border-t border-line p-sm">
              <slot name="footer" />
            </footer>
          </aside>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity var(--duration-base) var(--ease-out);
}
.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}
.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: transform var(--duration-base) var(--ease-out);
}
.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(100%);
}
/* 左侧贴靠时镜像滑入方向；双类选择器特异度高于上面的单类默认轨迹 */
.slide-from-left.drawer-slide-enter-from,
.slide-from-left.drawer-slide-leave-to {
  transform: translateX(-100%);
}
</style>
