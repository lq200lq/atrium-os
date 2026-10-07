<script setup lang="ts">
import { computed, defineAsyncComponent, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import OsButton from '@/ui/OsButton.vue'
import WidgetConfigFields from './WidgetConfigFields.vue'
import { useAppName } from '@/i18n'
import { provideWidgetConfigPanel } from '@/kernel/composables/useWidgetConfigPanel'
import { useWidgetRegistry } from '@/kernel/stores/widgetRegistry'

/**
 * 配置面容器（§4.12）：三处入口（卡片菜单弹层 / 抽屉内联 / 小组件中心）共用这一份实现——
 * 草稿与提交通道在这里建（`provideWidgetConfigPanel`），面板只负责表达。
 * 件声明了 `configEntry` 就换成件自绘的面板，否则按 schema 用 `WidgetConfigFields` 统一渲染；
 * 两条路都只拿通道，所以「恢复默认 / 完成」与写边界（`sanitizeConfig`）不会因换了面板而走散。
 */
const props = defineProps<{ instanceId: string }>()
const emit = defineEmits<{ close: [] }>()

const panel = provideWidgetConfigPanel(props.instanceId, () => emit('close'))
const registry = useWidgetRegistry()
const { t } = useI18n()
const appName = useAppName()

const kind = computed(() => registry.byId(panel.kindId))
const title = computed(() => appName(kind.value))
const schema = panel.schema
const values = panel.values
const dirty = panel.dirty

/** configEntry 每次解出一个新组件会让面板整体重挂（草稿不丢，但焦点与滚动会），因此按工厂缓存 */
const entryCache = new Map<() => Promise<Component>, Component>()

const entryComponent = computed(() => {
  const entry = kind.value?.configEntry
  if (!entry) return null
  let cached = entryCache.get(entry)
  if (!cached) {
    cached = defineAsyncComponent(entry)
    entryCache.set(entry, cached)
  }
  return cached
})
</script>

<template>
  <div data-widget-config-panel class="flex flex-col gap-sm">
    <div class="flex items-baseline justify-between gap-sm">
      <h4 class="truncate text-ui font-strong text-ink">{{ title }}</h4>
      <span class="shrink-0 text-caption text-ink-mute">{{ t('widgets.configSection') }}</span>
    </div>

    <p v-if="!schema.length" class="text-caption text-ink-mute">{{ t('widgets.configEmpty') }}</p>
    <component :is="entryComponent" v-else-if="entryComponent" :data-config-entry="panel.kindId" />
    <WidgetConfigFields
      v-else
      :fields="schema"
      :model-value="values"
      @update:model-value="panel.patch($event)"
    />

    <div class="flex items-center justify-between gap-sm">
      <span
        class="min-w-0 truncate text-caption"
        :class="dirty ? 'text-warning-text' : 'text-ink-mute'"
        >{{ dirty ? t('widgets.configPanel.unsaved') : '' }}</span
      >
      <div class="flex shrink-0 items-center gap-xs">
        <OsButton size="sm" :disabled="!schema.length" @click="panel.reset()">
          {{ t('widgets.configReset') }}
        </OsButton>
        <OsButton size="sm" variant="primary" @click="panel.close()">
          {{ t('widgets.configDone') }}
        </OsButton>
      </div>
    </div>
  </div>
</template>
