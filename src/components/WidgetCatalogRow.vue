<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import OsButton from '@/ui/OsButton.vue'
import OsDropdown from '@/ui/OsDropdown.vue'
import OsIcon from './OsIcon.vue'
import OsSegmented from '@/ui/OsSegmented.vue'
import WidgetPreview from './WidgetPreview.vue'
import WidgetSizeGlyph from './WidgetSizeGlyph.vue'
import { useAppName } from '@/i18n'
import { ROLES } from '@/kernel/stores/session'
import type { RegisteredWidget, WidgetSize } from '@/kernel/stores/widgetRegistry'
import { useWidgets } from '@/kernel/stores/widgets'
import { useFeedback } from '@/ui/feedback'

/**
 * 陈列卡（§4.8，2026-10-07 体验重构）：预览取景框（铺满卡宽、统一比例尺——选档时框随件长，
 * 「换档所见即所得」肉眼可见）+ 名称 + 一行描述 + 支持档位（字形行）+ 「添加」，生命周期收进「⋯」。
 * 常驻的尺寸分段控件被拿掉了——尺寸选择留在「添加」的展开条里（A-4：把各尺寸分组在一件之下，
 * 而不是让用户以为每种尺寸是一个不同的小组件）。无权限的 kind 走灰态卡，只告知不渲染预览。
 */
const props = defineProps<{ kind: RegisteredWidget; locked?: boolean }>()

const widgets = useWidgets()
const feedback = useFeedback()
const { t } = useI18n()
const appName = useAppName()

const name = computed(() => appName(props.kind))
const description = computed(() =>
  props.kind.descriptionKey ? t(props.kind.descriptionKey) : (props.kind.description ?? ''),
)
const sizes = computed(() => props.kind.widget.sizes)

/** 缩略用最小档：目录给的是「这件长什么样」，不是「桌面上现在多大」；
 *  选档展开时预览跟着所选档变形（所见即所得） */
const thumbSize = computed<WidgetSize>(() => {
  const list = sizes.value
  return list.find((s) => s !== 'lg') ?? list[0]
})

const state = computed(() => widgets.kindState(props.kind.id))
const onDesktop = computed(() => widgets.items.some((i) => i.kindId === props.kind.id))
const addDisabled = computed(() => Boolean(props.kind.singleton) && onDesktop.value)

const choosing = ref(false)
const picked = ref<WidgetSize>('sm')
const previewSize = computed<WidgetSize>(() => (choosing.value ? picked.value : thumbSize.value))

function openChooser() {
  if (addDisabled.value) return
  // 卸载过的 kind 也要能一步加上：先装回货架再摆实例，否则新实例根本不渲染
  if (!state.value.installed) widgets.install(props.kind.id)
  if (sizes.value.length < 2) {
    widgets.add(props.kind.id)
    return
  }
  picked.value = props.kind.widget.defaultSize ?? sizes.value[0]
  choosing.value = true
}

function confirmAdd() {
  widgets.add(props.kind.id, picked.value)
  choosing.value = false
}

/** 需要哪个角色：按权限点反查能授予它的角色名，而不是把权限 id 直接印在界面上。
 * 先认「显式列出该权限点」的角色——`*` 通吃的管理员永远在表头，照直取会把「需要编辑者」说成「需要管理员」。 */
const roleLabel = computed(() => {
  const perms = props.kind.permissions ?? []
  const granted = (r: (typeof ROLES)[number], wildcard: boolean) =>
    perms.every((p) => r.permissions.includes(p) || (wildcard && r.permissions.includes('*')))
  const role = ROLES.find((r) => granted(r, false)) ?? ROLES.find((r) => granted(r, true))
  return role ? t(`settings.roles.${role.id}`) : perms.join('、')
})

const menuItems = computed(() => [
  {
    key: 'enabled',
    label: state.value.enabled ? t('widgets.disable') : t('widgets.enable'),
    disabled: !state.value.installed,
  },
  {
    key: 'lifecycle',
    label: state.value.installed ? t('widgets.uninstall') : t('widgets.install'),
    danger: state.value.installed,
  },
])

function onMenu(key: string) {
  if (key === 'enabled') widgets.setEnabled(props.kind.id, !state.value.enabled)
  if (key === 'lifecycle') void onLifecycle()
}

/** 卸载会连带摘掉全部实例，不可逆到需要一次确认；装回来只回到货架，实例不复活 */
async function onLifecycle() {
  if (!state.value.installed) {
    widgets.install(props.kind.id)
    return
  }
  const ok = await feedback.confirm({ title: t('widgets.uninstallConfirm', { name: name.value }) })
  if (ok) widgets.uninstall(props.kind.id)
}
</script>

<template>
  <li
    :data-widget-kind-row="kind.id"
    class="flex flex-col rounded-surface border border-line bg-surface p-sm"
    :class="locked ? 'opacity-60' : ''"
  >
    <!-- 陈列取景框：铺满卡宽、高度自然生长——统一比例尺让「换档所见即所得」肉眼可见 -->
    <WidgetPreview
      v-if="!locked"
      :kind-id="kind.id"
      :size="previewSize"
      fit="ratio"
      class="w-full"
    />
    <div v-else class="flex h-24 items-center justify-center">
      <OsIcon name="lock" :size="24" class="text-ink-mute" />
    </div>

    <div class="mt-xs flex min-w-0 flex-1 flex-col gap-2xs">
      <span class="truncate text-ui font-strong text-ink">{{ name }}</span>
      <p class="text-caption leading-relaxed text-ink-mute">{{ description }}</p>
      <p v-if="locked" class="text-caption text-ink-mute">
        {{ t('widgets.requiresRole', { role: roleLabel }) }}
      </p>

      <div v-if="!locked" class="flex flex-wrap items-center gap-xs">
        <span
          v-for="s in sizes"
          :key="s"
          class="inline-flex items-center gap-2xs text-caption text-ink-mute"
        >
          <WidgetSizeGlyph :size="s" />
          {{ t(`widgets.sizes.${s}`) }}
        </span>
      </div>
    </div>

    <div class="mt-xs flex items-center gap-2xs">
      <OsButton
        size="sm"
        :tint="kind.tint"
        :disabled="locked || addDisabled"
        data-widget-add
        class="gap-2xs"
        @click="openChooser"
      >
        <OsIcon name="plus" :size="14" />
        {{ addDisabled ? t('widgets.added') : t('widgets.add') }}
      </OsButton>

      <OsDropdown v-if="!locked" :items="menuItems" placement="bottom-end" @click="onMenu">
        <button
          type="button"
          class="flex h-6 w-6 items-center justify-center rounded-control border border-line text-ink-mute transition hover:bg-surface-hover"
          :aria-label="t('common.actions')"
        >
          <OsIcon name="more-horizontal" :size="12" />
        </button>
      </OsDropdown>
    </div>

    <div
      v-if="choosing"
      data-widget-size-chooser
      class="mt-xs flex flex-wrap items-center justify-between gap-xs border-t border-line-soft pt-xs"
    >
      <span class="text-caption text-ink-mute">{{ t('widgets.chooseSize') }}</span>
      <div class="flex items-center gap-xs">
        <OsSegmented
          :label="t('widgets.sizeLabel')"
          :options="sizes.map((s) => ({ value: s, label: t(`widgets.sizes.${s}`) }))"
          :model-value="picked"
          size="sm"
          @update:model-value="picked = $event as WidgetSize"
        >
          <template #option-prefix="{ option }">
            <WidgetSizeGlyph :size="option.value as WidgetSize" />
          </template>
        </OsSegmented>
        <OsButton size="sm" variant="primary" @click="confirmAdd">{{
          t('common.confirm')
        }}</OsButton>
        <OsButton size="sm" @click="choosing = false">{{ t('common.cancel') }}</OsButton>
      </div>
    </div>
  </li>
</template>
