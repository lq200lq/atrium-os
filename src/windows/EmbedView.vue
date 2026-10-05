<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OsButton from '@/ui/OsButton.vue'
import OsEmpty from '@/ui/OsEmpty.vue'
import OsIcon from '@/components/OsIcon.vue'
import OsResult from '@/ui/OsResult.vue'
import OsSpin from '@/ui/OsSpin.vue'
import { useWindowContext } from '@/kernel/composables/useWindowContext'
import { useAppRegistry } from '@/kernel/stores/appRegistry'

/**
 * embed 类目的唯一渲染实现（决策 D2′）：iframe 只存在于内容区，壳层/材质/动画不认识它的存在。
 * 因此全仓别处不应再出现 <iframe>——应用要嵌外部站点就注册 embed manifest。
 */

// 跨源被拒（X-Frame-Options / CSP frame-ancestors）时 frame 里只剩一个父页读不到的空文档，
// 且 @load 照常触发，所以「加载失败」在原理上不可检测。这里只给超时提示 + 出口，不假装识别。
const TIMEOUT_MS = 8000

// 刻意不给 allow-top-navigation：frame-busting（内嵌页把顶层窗口跳走）是本组件唯一真防线；
// allow-scripts + allow-same-origin 只对同源文档构成沙箱逃逸，而用户地址按构造是第三方。
// 例外是自述的 fixture 与本仓库同源文档站，它们等于未沙箱——新增同源入口前先确认这个代价。
const SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-presentation'
const ALLOW = 'fullscreen; clipboard-read; clipboard-write; autoplay'

type Phase = 'loading' | 'ready' | 'timeout' | 'failed'

const { t } = useI18n()
const { win } = useWindowContext()
const registry = useAppRegistry()

const embed = computed(() => registry.byId(win.value.appId)?.embed)
/**
 * manifest 里的地址是**代码**：内置应用写死同源入口（`/docs/index.html`），用户应用的地址已在
 * webApps.add 的写入边界归一过。所以这里只判空，不再校验——同源相对地址是一等写法。
 */
const url = computed(() => embed.value?.url.trim() ?? '')
const hasUrl = computed(() => url.value.length > 0)
// 工具栏只展示主机名，完整地址留给 title；相对入口自然退化成本站 host
const host = computed(() => {
  if (!hasUrl.value) return ''
  try {
    return new URL(url.value, window.location.href).host
  } catch {
    return url.value
  }
})

const attempt = ref(0)
const phase = ref<Phase>('loading')
let timer: ReturnType<typeof setTimeout> | undefined

function clearTimer() {
  if (timer !== undefined) clearTimeout(timer)
  timer = undefined
}

function start() {
  clearTimer()
  if (!hasUrl.value) return
  phase.value = 'loading'
  timer = setTimeout(() => {
    // @load 已到达就不覆盖：超时只是「还没等到」的兜底提示
    if (phase.value === 'loading') phase.value = 'timeout'
  }, TIMEOUT_MS)
}

// 同一实例可能随窗口切换 appId 复用（KeepAlive），地址变了就重新计时
watch(
  () => [url.value, attempt.value] as const,
  () => start(),
  { immediate: true },
)
onUnmounted(clearTimer)

function retry() {
  attempt.value += 1 // 跨源无法调 contentWindow.location.reload()，只能换 key 重挂
}

function openInTab() {
  if (url.value) window.open(url.value, '_blank', 'noopener')
}
</script>

<template>
  <div class="flex h-full flex-col text-ui">
    <div
      v-if="hasUrl"
      class="flex shrink-0 items-center gap-2 border-b border-line bg-surface-sunken/60 px-4 py-2"
    >
      <OsIcon name="globe" :size="14" class="shrink-0 text-ink-mute" />
      <span class="min-w-0 flex-1 truncate text-ink-mute" :title="url">{{ host }}</span>
      <OsButton size="sm" @click="retry">{{ t('embed.retry') }}</OsButton>
      <OsButton size="sm" @click="openInTab">
        {{ t('embed.openInTab') }}
      </OsButton>
    </div>

    <div class="relative min-h-0 flex-1">
      <OsEmpty v-if="!hasUrl" icon="globe" :description="t('embed.invalid')" />
      <template v-else>
        <!-- iframe 必须立刻挂载：不挂就永远等不到 load；:key 换实例即为重试 -->
        <iframe
          :key="attempt"
          class="block h-full w-full"
          :src="url"
          :title="win.title"
          :sandbox="SANDBOX"
          :allow="ALLOW"
          @load="phase = 'ready'"
          @error="phase = 'failed'"
        />
        <div
          v-if="phase === 'loading'"
          class="absolute inset-0 flex items-center justify-center bg-glass-base"
        >
          <OsSpin :tip="t('embed.loading')" />
        </div>
        <div
          v-else-if="phase === 'timeout' || phase === 'failed'"
          class="absolute inset-0 flex items-center justify-center overflow-y-auto bg-glass-base p-4"
        >
          <OsResult
            :status="phase === 'timeout' ? 'warning' : 'error'"
            :title="phase === 'timeout' ? t('embed.timeoutTitle') : t('embed.failedTitle')"
            :subtitle="phase === 'timeout' ? t('embed.timeoutSubtitle') : t('embed.failedSubtitle')"
          >
            <template #extra>
              <OsButton size="sm" @click="retry">{{ t('embed.retry') }}</OsButton>
              <OsButton size="sm" variant="primary" @click="openInTab">
                {{ t('embed.openInTab') }}
              </OsButton>
            </template>
          </OsResult>
        </div>
      </template>
    </div>
  </div>
</template>
