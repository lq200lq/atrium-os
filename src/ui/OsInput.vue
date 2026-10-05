<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import type { Size, Status } from './types'
import ControlShell from './internal/ControlShell.vue'

withDefaults(
  defineProps<{
    placeholder?: string
    size?: Size
    disabled?: boolean
    status?: Status
    clearable?: boolean
  }>(),
  { placeholder: '', size: 'md', disabled: false, status: 'default', clearable: false },
)

const model = defineModel<string>({ default: '' })
const emit = defineEmits<{ enter: []; esc: []; clear: [] }>()
const { t } = useI18n()

function onClear() {
  model.value = ''
  emit('clear')
}
</script>

<template>
  <ControlShell :size="size" :status="status" :disabled="disabled">
    <span v-if="$slots.prefix" class="flex shrink-0 items-center text-ink-mute">
      <slot name="prefix" />
    </span>
    <input
      v-model="model"
      :placeholder="placeholder"
      :disabled="disabled"
      class="min-w-0 flex-1 bg-transparent text-ui text-ink"
      @keydown.enter="emit('enter')"
      @keydown.esc="emit('esc')"
    />
    <template #suffix>
      <button
        v-if="clearable && model"
        type="button"
        :aria-label="t('common.clear')"
        class="shrink-0 text-ink-mute transition hover:text-ink"
        @click="onClear"
      >
        <OsIcon name="x" :size="14" />
      </button>
      <span v-if="$slots.suffix" class="flex shrink-0 items-center text-ink-mute">
        <slot name="suffix" />
      </span>
    </template>
  </ControlShell>
</template>
