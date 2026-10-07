<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWidgetContext } from '@/kernel/composables/useWidgetContext'
import { useWidgetData } from '@/kernel/composables/useWidgetData'

interface StickyNoteData {
  text?: string
  /** 仅预览样例使用：文案以 key 形态进语言包，避免英文界面预览显示中文（§4.8） */
  textKey?: string
}

const { size, preview } = useWidgetContext()
const { data, write, status } = useWidgetData<StickyNoteData>('sticky-note', () => ({ text: '' }))
const { t } = useI18n()

const display = computed(() => {
  const d = data.value
  if (d?.textKey) return t(d.textKey)
  return d?.text ?? ''
})

const touched = ref(false)

function onInput(e: Event) {
  if (preview) return
  touched.value = true
  write({ text: (e.target as HTMLTextAreaElement).value })
}

const savedLine = computed(() =>
  touched.value && status.value === 'idle' ? t('widgets.sticky.saved') : '',
)
</script>

<template>
  <!-- sm：首行只读 + 只读提示（内容预算 2 行） -->
  <div v-if="size === 'sm'" class="h-full flex flex-col justify-center gap-2xs">
    <p class="truncate text-ui" :class="display ? 'text-widget-ink' : 'text-widget-ink-disabled'">
      {{ display || t('widgets.sticky.placeholder') }}
    </p>
    <p class="text-caption text-widget-ink-disabled">{{ t('widgets.sticky.readonly') }}</p>
  </div>

  <!-- md：摘要只读（内容预算 4 行） -->
  <div v-else-if="size === 'md'" class="h-full flex min-h-0 flex-col justify-center gap-2xs">
    <p
      class="line-clamp-4 text-ui"
      :class="display ? 'text-widget-ink' : 'text-widget-ink-disabled'"
    >
      {{ display || t('widgets.sticky.placeholder') }}
    </p>
    <p v-if="savedLine" class="shrink-0 text-caption text-widget-ink-mute">{{ savedLine }}</p>
  </div>

  <!-- lg：就地编辑，卡内即终点 -->
  <div v-else class="h-full flex min-h-0 flex-col gap-2xs">
    <textarea
      class="min-h-0 w-full flex-1 resize-none rounded-surface border border-widget-line bg-widget-fill p-xs text-ui text-widget-ink placeholder:text-widget-ink-disabled"
      :value="display"
      :placeholder="t('widgets.sticky.placeholder')"
      :readonly="preview"
      :aria-label="t('widgets.sticky.placeholder')"
      @input="onInput"
    />
    <p v-if="savedLine" class="shrink-0 text-caption text-widget-ink-mute">{{ savedLine }}</p>
  </div>
</template>
