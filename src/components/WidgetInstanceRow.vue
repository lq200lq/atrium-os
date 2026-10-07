<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OsBadge from '@/ui/OsBadge.vue'
import OsButton from '@/ui/OsButton.vue'
import OsDropdown from '@/ui/OsDropdown.vue'
import OsIcon from './OsIcon.vue'
import OsSegmented from '@/ui/OsSegmented.vue'
import WidgetConfigPanel from './WidgetConfigPanel.vue'
import WidgetPreview from './WidgetPreview.vue'
import WidgetSizeGlyph from './WidgetSizeGlyph.vue'
import { useAppName } from '@/i18n'
import { useOS } from '@/kernel/composables/useOS'
import {
  resolveOpenTarget,
  useWidgetRegistry,
  type WidgetSize,
} from '@/kernel/stores/widgetRegistry'
import { useWidgetRuntime } from '@/kernel/stores/widgetRuntime'
import { useWidgets } from '@/kernel/stores/widgets'
import { useShellUi } from '@/kernel/stores/shellUi'
import { useFeedback } from '@/ui/feedback'

/**
 * 台账行（§4.8，2026-10-07 体验重构）：固定取景框预览（统一比例尺，保「桌面多大」的相对真值）
 * + 身份列（名称 + 状态徽标）+ 单一动作栏。行首那个单独的档位文字删掉了——多档件的分段控件
 * （段内带尺寸字形）就是当前档的唯一表达，单档件才给「字形 + 档位」chip：同一状态在同一行只说一遍。
 * 状态三级显式分级（OsBadge）：未显示+成因（warning）/ 已禁用 / 已手动摆放。
 * 不给添加/卸载——那是 kind 的事，收进「⋯」。排序把手对流式件生效、对手动摆放的实例置灰
 * （L-9：它已经脱离流式序列）。换尺寸的分段控件与卡片菜单的档位组写的是同一个 `instance.size`：
 * 两个入口，一个权威。
 */
const props = defineProps<{ instanceId: string }>()

const registry = useWidgetRegistry()
const widgets = useWidgets()
const runtime = useWidgetRuntime()
const ui = useShellUi()
const os = useOS()
const feedback = useFeedback()
const { t } = useI18n()
const appName = useAppName()

const instance = computed(() => widgets.byId(props.instanceId))
const kind = computed(() => registry.byId(instance.value?.kindId ?? ''))
const name = computed(() => appName(kind.value))
const placement = computed(() => runtime.placementOf(props.instanceId))
const manual = computed(() => Boolean(instance.value?.pos))
const sizes = computed<WidgetSize[]>(() => kind.value?.widget.sizes ?? [])

const configOpen = ref(ui.focusInstanceId === props.instanceId)
const root = ref<HTMLElement | null>(null)

function reveal() {
  configOpen.value = true
  void nextTick(() => root.value?.scrollIntoView({ block: 'center' }))
}

/** 溢出清单行的「在管理台定位」带着实例 id 进来：展开这一行并滚到视线里（§4.5 / §4.7 第 3 步） */
watch(
  () => ui.focusInstanceId,
  (id) => {
    if (id === props.instanceId) reveal()
  },
)
// 中心窗口这条宿主是「先设 id、后挂行」，没有可 watch 的变化，挂载时自己滚一次
onMounted(() => {
  if (configOpen.value) reveal()
})

const sizeOptions = computed(() =>
  sizes.value.map((size) => ({ value: size, label: t(`widgets.sizes.${size}`) })),
)

/** 下钻可达才给「打开应用」：与卡片同一份 payload 构造（件把选中内容交给应用） */
const drill = computed(() => {
  const current = instance.value
  if (!current || !kind.value) return null
  const target = resolveOpenTarget(kind.value.openAppId, {
    size: current.size,
    config: current.config ?? {},
    selected: widgets.selected[props.instanceId],
  })
  if (!target || !os.can(target.appId)) return null
  return target
})

/** 顺序权威是数组下标（§4.7 第 1 步），行内只需要这一个位置读数 */
const orderIndex = computed(() => widgets.renderable.findIndex((i) => i.id === props.instanceId))
const kindEnabled = computed(() => widgets.kindState(kind.value?.id ?? '').enabled)

const canMoveUp = computed(() => !manual.value && orderIndex.value > 0)
const canMoveDown = computed(
  () => !manual.value && orderIndex.value < widgets.renderable.length - 1,
)

function moveBy(dir: 1 | -1) {
  if (orderIndex.value === -1) return
  widgets.move(props.instanceId, orderIndex.value + dir)
}

const menuItems = computed(() => {
  const items: { key: string; label: string; danger?: boolean }[] = []
  if (kind.value?.refresh && kind.value.refresh !== 'manual') {
    items.push({ key: 'refresh', label: t('widgets.refreshNow') })
  }
  if (drill.value) items.push({ key: 'open', label: t('widgets.openApp') })
  if (manual.value) items.push({ key: 'release', label: t('widgets.releasePlacement') })
  items.push({ key: 'remove', label: t('widgets.remove'), danger: true })
  return items
})

function onMenu(key: string) {
  if (key === 'refresh') runtime.requestRefresh(props.instanceId)
  if (key === 'open' && drill.value) os.open(drill.value.appId, drill.value.payload)
  if (key === 'release') widgets.releasePosition(props.instanceId)
  if (key === 'remove') void onRemove()
}

async function onRemove() {
  const ok = await feedback.confirm({
    title: t('widgets.removeConfirm', { name: name.value }),
    content: t('widgets.dataIntro'),
  })
  if (ok) widgets.remove(props.instanceId)
}
</script>

<template>
  <li
    v-if="instance && kind"
    ref="root"
    :data-widget-instance-row="instanceId"
    class="rounded-surface border border-line bg-surface p-sm"
  >
    <div class="flex items-start gap-sm">
      <!-- 台账取景框：96×96 定框 + 统一比例尺（锚 lg 宽），全行同尺保「桌面多大」的相对真值 -->
      <WidgetPreview
        :kind-id="kind.id"
        :size="instance.size"
        fit="ratio"
        :frame-w="96"
        :frame-h="96"
      />

      <div class="flex min-w-40 flex-1 flex-col gap-xs">
        <div class="flex items-center justify-between gap-xs">
          <span class="truncate text-ui font-strong text-ink">{{ name }}</span>
          <OsBadge v-if="!placement.visible" dot status="warning" class="shrink-0">
            {{ t('widgets.notOnDesktop') }} ·
            {{ t(`widgets.overflowReason.${placement.overflow}`) }}
          </OsBadge>
          <OsBadge v-else-if="!kindEnabled" dot class="shrink-0">
            {{ t('widgets.disabled') }}
          </OsBadge>
          <OsBadge v-else-if="placement.manual" dot class="shrink-0">
            {{ t('widgets.placedManual') }}
          </OsBadge>
        </div>

        <div class="flex flex-wrap items-center gap-2xs">
          <OsSegmented
            v-if="sizes.length > 1"
            :label="`${name} · ${t('widgets.sizeLabel')}`"
            :options="sizeOptions"
            :model-value="instance.size"
            size="sm"
            @update:model-value="widgets.setSize(instanceId, $event as WidgetSize)"
          >
            <template #option-prefix="{ option }">
              <WidgetSizeGlyph :size="option.value as WidgetSize" />
            </template>
          </OsSegmented>

          <span
            v-else
            class="inline-flex items-center gap-2xs rounded-chip bg-fill px-2xs py-2xs text-caption text-ink-mute"
          >
            <WidgetSizeGlyph :size="instance.size" />
            {{ t(`widgets.sizes.${instance.size}`) }}
          </span>

          <OsButton size="sm" class="gap-2xs" @click="configOpen = !configOpen">
            <OsIcon name="settings" :size="14" />
            {{ t('widgets.configure') }}
          </OsButton>

          <!-- 图标三件收一簇：窄容器折行只发生在控件组之间，⋯ 不会孤零零掉到下一行 -->
          <div class="flex items-center gap-2xs">
            <button
              type="button"
              class="flex h-6 w-6 items-center justify-center rounded-control border border-line text-ink-mute transition disabled:is-disabled hover:bg-surface-hover"
              :disabled="!canMoveUp"
              :aria-label="t('widgets.moveUp')"
              :title="t('widgets.moveUp')"
              @click="moveBy(-1)"
            >
              <OsIcon name="arrow-up" :size="12" />
            </button>
            <button
              type="button"
              class="flex h-6 w-6 items-center justify-center rounded-control border border-line text-ink-mute transition disabled:is-disabled hover:bg-surface-hover"
              :disabled="!canMoveDown"
              :aria-label="t('widgets.moveDown')"
              :title="t('widgets.moveDown')"
              @click="moveBy(1)"
            >
              <OsIcon name="arrow-down" :size="12" />
            </button>

            <OsDropdown :items="menuItems" placement="bottom-end" @click="onMenu">
              <button
                type="button"
                class="flex h-6 w-6 items-center justify-center rounded-control border border-line text-ink-mute transition hover:bg-surface-hover"
                :aria-label="t('common.actions')"
              >
                <OsIcon name="more-horizontal" :size="12" />
              </button>
            </OsDropdown>
          </div>
        </div>
      </div>
    </div>

    <WidgetConfigPanel
      v-if="configOpen"
      :instance-id="instanceId"
      class="mt-sm border-t border-line-soft pt-sm"
      @close="configOpen = false"
    />
  </li>
</template>
