<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import OsButton from '@/ui/OsButton.vue'
import OsResult from '@/ui/OsResult.vue'
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
  <!-- 窗口体高度归窗口管理，错误态在可用区内居中；文案细节由 OsResult 承担 -->
  <div v-if="message" class="flex h-full items-center justify-center">
    <OsResult status="error" :title="t('errorboundary.title')" :subtitle="message" class="w-full">
      <template #extra>
        <OsButton size="sm" @click="reload">{{ t('errorboundary.reload') }}</OsButton>
      </template>
    </OsResult>
  </div>
  <slot v-else />
</template>
