<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'

withDefaults(
  defineProps<{
    title?: string
    placement?: 'right' | 'left'
    width?: string
  }>(),
  { title: '', placement: 'right', width: '360px' },
)

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()

function close() {
  open.value = false
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="open" class="fixed inset-0 z-[9996] bg-scrim" @pointerdown.self="close">
        <Transition name="drawer-slide">
          <aside
            v-if="open"
            class="absolute top-0 flex h-full flex-col border-glass-border-active bg-glass-pop shadow-pop backdrop-blur-xl"
            :class="[placement === 'right' ? 'right-0 border-l' : 'left-0 border-r']"
            :style="{ width }"
            role="dialog"
            aria-modal="true"
          >
            <header
              class="flex h-11 shrink-0 items-center justify-between border-b border-line px-4"
            >
              <span class="text-title font-medium text-ink">{{ title }}</span>
              <button
                class="text-ink-mute hover:text-ink"
                :title="t('common.close')"
                @click="close"
              >
                <OsIcon name="x" :size="16" />
              </button>
            </header>
            <div class="min-h-0 flex-1 overflow-y-auto p-4 text-ui text-ink">
              <slot />
            </div>
            <footer v-if="$slots.footer" class="shrink-0 border-t border-line p-3">
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
</style>
