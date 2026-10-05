<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import OsButton from '@/ui/OsButton.vue'
import { useErrorLog } from '@/kernel/observability/errorLog'

const props = defineProps<{ appId?: string }>()
const { t } = useI18n()
const errorLog = useErrorLog()
const message = ref<string | null>(null)

// 捕获子树（应用组件）渲染/生命周期错误：落错误日志并就地显示错误态，返回 false 阻断冒泡，
// 使单个应用崩溃不拖垮壳层，也不触发全局 errorHandler 重复记录。
onErrorCaptured((err) => {
  message.value = err instanceof Error ? err.message : String(err)
  errorLog.captureError('window', err, props.appId)
  return false
})

function reload() {
  message.value = null
}
</script>

<template>
  <div
    v-if="message"
    class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
  >
    <OsIcon name="alert-triangle" :size="28" class="text-danger" />
    <p class="text-ui font-strong text-ink">{{ t('errorboundary.title') }}</p>
    <p class="max-w-full truncate text-caption text-ink-mute" :title="message">{{ message }}</p>
    <OsButton size="sm" @click="reload">{{ t('errorboundary.reload') }}</OsButton>
  </div>
  <slot v-else />
</template>
