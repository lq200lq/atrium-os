<script setup lang="ts">
import { ref, watch } from 'vue'
import OsIcon from '@/components/OsIcon.vue'
import { useNotification, type Notice } from '@/kernel/stores/notification'

// 吐司不另起一套状态：直接消费 notification store，最新一条以瞬态浮层呈现，数秒后自动收起
const notif = useNotification()
const TTL = 3500

const visible = ref<Notice | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
let lastId = 0

watch(
  () => notif.items[0]?.id,
  (id) => {
    if (!id || id === lastId) return
    lastId = id
    visible.value = notif.items[0]
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => (visible.value = null), TTL)
  },
)

function hide() {
  if (timer) clearTimeout(timer)
  visible.value = null
}
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="visible"
        class="pointer-events-auto fixed bottom-20 left-1/2 z-toast flex w-72 -translate-x-1/2 items-center gap-2 rounded-surface border border-glass-border-active bg-glass-pop px-4 py-3 shadow-pop backdrop-blur-xl"
        role="status"
        @click="hide"
      >
        <OsIcon name="bell" :size="16" class="shrink-0 text-accent-strong" />
        <div class="min-w-0 flex-1 text-ui">
          <p class="font-strong text-ink">{{ visible.title }}</p>
          <p v-if="visible.body" class="truncate text-caption text-ink-mute">{{ visible.body }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity var(--duration-base) var(--ease-out),
    transform var(--duration-base) var(--ease-out);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 12px);
}
</style>
