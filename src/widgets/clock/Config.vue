<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import OsInput from '@/ui/OsInput.vue'
import WidgetConfigFields from '@/components/WidgetConfigFields.vue'
import { useWidgetConfigPanel } from '@/kernel/composables/useWidgetConfigPanel'
import { ZONE_VALUES } from './zones'

/**
 * 时钟的自绘配置面板（§4.12 的第一个用户）：`secondTz` 有 18 个城市候选且需要搜索，
 * schema 的四类控件表达不了——这正是声明 `configEntry` 的判据。
 * 面板只改草稿（`setValue`），提交/材质/焦点仍归宿主；这里拿不到任何平台动作（台账 C-⑤）。
 */
const panel = useWidgetConfigPanel()
const { t, te } = useI18n()
const keyword = ref('')

/** 除第二时区之外的字段仍由 schema 渲染器画——自绘只换表达最弱的那一项，不是重写整个表单 */
const otherFields = computed(() => panel.schema.value.filter((f) => f.key !== 'secondTz'))
const current = computed(() => String(panel.values.value.secondTz ?? 'local'))

function labelOf(value: string): string {
  const key = `widgets.configOptions.tz.${value}`
  return te(key) ? t(key) : value
}

const matches = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return [...ZONE_VALUES]
  return ZONE_VALUES.filter(
    (v) => v.toLowerCase().includes(q) || labelOf(v).toLowerCase().includes(q),
  )
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <WidgetConfigFields
      :fields="otherFields"
      :model-value="panel.values.value"
      @update:model-value="panel.patch($event)"
    />

    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <span class="text-ui text-ink">{{ t('widgets.config.secondTz') }}</span>
        <span class="text-caption text-ink-mute"
          >{{ t('widgets.configPanel.current') }}：{{ labelOf(current) }}</span
        >
      </div>

      <OsInput
        v-model="keyword"
        :placeholder="t('widgets.clock.searchCity')"
        :aria-label="t('widgets.clock.searchCity')"
        clearable
      />

      <ul class="max-h-56 min-h-24 overflow-y-auto rounded-control border border-line-divider">
        <li v-if="!matches.length" class="px-control py-2 text-ui text-ink-mute">
          {{ t('widgets.configPanel.noMatch') }}
        </li>
        <li v-for="value in matches" :key="value">
          <button
            type="button"
            class="flex h-control w-full items-center justify-between gap-2 px-control text-left text-ui transition duration-quick hover:bg-fill-hover"
            :class="value === current ? 'text-primary' : 'text-ink'"
            :aria-pressed="value === current"
            @click="panel.setValue('secondTz', value)"
          >
            <span>{{ labelOf(value) }}</span>
            <OsIcon v-if="value === current" name="check" :size="14" />
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
