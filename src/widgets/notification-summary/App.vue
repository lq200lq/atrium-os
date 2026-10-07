<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import { useNotification } from '@/kernel/stores/notification'
import { useShellUi } from '@/kernel/stores/shellUi'
import { useWidgetContext, WIDGET_PREVIEW_KEY } from '@/kernel/composables/useWidgetContext'
import { useWidgetStatus } from '@/kernel/composables/useWidgetStatus'
import { useWidgetUpdated } from '@/kernel/composables/useWidgetUpdated'

/**
 * 通知摘要（§4.9 批次 C）：主结论＝「我有几条没看」。
 * 数据源 `useNotification()` 只读；下钻打开壳层通知中心（manifest 上以下钻豁免标记说明为何无 appId）。
 * 未读数除颜色外有数字 + bell 图标通道（H-3）。
 */
const { manifest, size, preview, kindId } = useWidgetContext()
const notif = useNotification()
const ui = useShellUi()
const status = useWidgetStatus()
const updated = useWidgetUpdated()
const { t } = useI18n()

/** 预览沙箱喂 /MyData 之外的样例：键与 useWidgetData 的 dataKey 同法解析（本件无 manifest.data ⇒ 落 kind id） */
const sample = inject(WIDGET_PREVIEW_KEY, null)?.sample?.[kindId.value] as
  { unread?: number; items?: { titleKey?: string; title?: string }[] } | undefined

/** 拿不到的数据整项不渲染：无标题的条目直接丢掉 */
function rowText(item: { titleKey?: string; title?: string }): string {
  if (item.titleKey) return t(item.titleKey)
  return item.title ?? ''
}

const rows = computed(() => {
  if (preview) {
    return (sample?.items ?? [])
      .map((item, i) => ({ key: `p-${i}`, text: rowText(item) }))
      .filter((r) => r.text)
      .slice(0, 3)
  }
  return notif.items
    .slice(0, 3)
    .map((n) => ({ key: `n-${n.id}`, text: n.title }))
    .filter((r) => r.text)
})

const unread = computed(() => {
  if (preview)
    return typeof sample?.unread === 'number' ? sample.unread : (sample?.items?.length ?? 0)
  return notif.unread
})

const name = computed(() => t(manifest.value?.nameKey ?? 'widgets.names.notification-summary'))

/** 取数节奏＝store 响应式 + 宿主 refresh 信号；件不轮询、不自持定时器 */
status.markRefreshed()
status.onRefresh(() => status.markRefreshed())

function openCenter() {
  // 通知中心是壳层面板而非应用：没有 appId 可给 openAppId，改走 shellUi 开关（§4.5 交互型）
  ui.openNotifications()
}
</script>

<template>
  <!-- md 档行数预算 ≤4：标题行（含未读数）+ 最近 3 条；sm 档＝一个数字 + 一行标签（§4.4 R1） -->
  <div v-if="size === 'sm'" class="flex h-full flex-col">
    <button
      type="button"
      class="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-2xs rounded-chip transition duration-quick hover:bg-widget-fill"
      :aria-label="name"
      @click="openCenter"
    >
      <OsIcon name="bell" :size="12" />
      <p class="text-heading-1 font-strong">{{ unread }}</p>
      <p class="text-caption text-widget-ink-mute">
        {{ t('widgets.notifications.unread', { count: unread }) }}
      </p>
      <p data-widget-updated class="text-caption text-widget-ink-disabled">{{ updated }}</p>
    </button>
  </div>

  <div v-else class="flex h-full flex-col gap-2xs">
    <!-- 交互型件：标题行自己做成下钻入口（§4.5）；命中区 h-6=24px -->
    <button
      type="button"
      class="flex h-6 w-full shrink-0 items-center gap-2xs rounded-chip px-2xs text-left transition duration-quick hover:bg-widget-fill"
      :aria-label="name"
      @click="openCenter"
    >
      <OsIcon name="bell" :size="12" class="shrink-0" />
      <span class="min-w-0 flex-1 truncate text-caption font-strong">{{ name }}</span>
      <span class="shrink-0 text-caption text-widget-ink-mute">
        {{ t('widgets.notifications.unread', { count: unread }) }}
      </span>
      <!-- md 档预算被标题行 + 3 条排满（实测内容包围盒＝内框 97.6%），读数走标题行右端不加行（§4.4 R1） -->
      <span data-widget-updated class="shrink-0 text-caption text-widget-ink-disabled">{{
        updated
      }}</span>
    </button>

    <ul v-if="rows.length" class="flex min-h-0 flex-1 flex-col gap-2xs">
      <li v-for="row in rows" :key="row.key" class="truncate text-caption">{{ row.text }}</li>
    </ul>
    <p v-else class="flex min-h-0 flex-1 items-center text-caption text-widget-ink-disabled">
      {{ t('widgets.notifications.empty') }}
    </p>
  </div>
</template>
