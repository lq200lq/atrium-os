<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OsMenu from './OsMenu.vue'
import type { MenuItem, Placement } from './types'
import { placementClass } from './internal/placement'

export type { MenuItem } from './types'

/**
 * 菜单型浮层：触发槽 + 浮层，浮层内部复用 OsMenu（键盘导航委托给它，不在此重抄）。
 * 开合/焦点行为照 OsPopconfirm（S10-A）的模式：打开时焦点进菜单首项、Esc 与外点关闭
 * 并把焦点还给触发元素；层级 z-panel，定位走 S10 placement 原语（不做 viewport 翻转）。
 */
const props = withDefaults(
  defineProps<{
    /** 浮层内 OsMenu 的条目（含二级 children 时由 OsMenu 自行处理） */
    items: MenuItem[]
    /** 打开方式：click 点击触发槽切换；hover 移入打开、移出关闭（点击同样可开，键盘可达） */
    trigger?: 'hover' | 'click'
    /** 浮层方位，走 internal/placement 原语；缺省从触发槽下方左对齐展开 */
    placement?: Placement
    /** 禁用：不响应触发，整体走 is-disabled 唯一写法 */
    disabled?: boolean
  }>(),
  { trigger: 'click', placement: 'bottom-start', disabled: false },
)

const emit = defineEmits<{
  /** 浮层内菜单条目被选中时透传 OsMenu 的 click 事件；载荷为被选中的 key */
  click: [key: string]
}>()

const { t } = useI18n()

// v-model:open 受控与非受控同一条路径（未绑定时退化为内部状态）
const open = defineModel<boolean>('open', { default: false })

/** 根节点同时是触发容器：tabindex=-1 让关闭后焦点可程序化回到触发元素 */
const root = ref<HTMLElement | null>(null)
const menuRef = ref<InstanceType<typeof OsMenu> | null>(null)

function show() {
  if (props.disabled) return
  open.value = true
}

function hide() {
  if (!open.value) return
  // 只有焦点确实在浮层/触发区内才回焦，避免外点鼠标关闭时抢焦点
  const restore = !!root.value?.contains(document.activeElement)
  open.value = false
  if (restore) {
    nextTick(() => {
      const triggerEl = root.value?.querySelector<HTMLElement>(
        'button,a[href],[role="button"],[tabindex]:not([tabindex="-1"])',
      )
      ;(triggerEl ?? root.value)?.focus()
    })
  }
}

function toggle() {
  if (open.value) hide()
  else show()
}

function onMenuClick(key: string) {
  emit('click', key)
  hide()
}

function onDocPointerdown(event: Event) {
  if (root.value && !root.value.contains(event.target as Node)) hide()
}

// 点外部关闭：监听只在打开期间挂在 document 上，关闭与卸载都必须解绑。
// 焦点进入首项也在此处统一触发（外部 v-model:open=true 同样生效）；
// hover 模式不抢键盘焦点。
watch(
  open,
  (isOpen) => {
    if (isOpen) {
      document.addEventListener('pointerdown', onDocPointerdown)
      if (props.trigger === 'click') nextTick(() => menuRef.value?.focusFirst())
    } else {
      document.removeEventListener('pointerdown', onDocPointerdown)
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointerdown))
</script>

<template>
  <span
    ref="root"
    class="relative inline-flex"
    :class="disabled ? 'is-disabled' : ''"
    tabindex="-1"
    @click="disabled ? undefined : toggle()"
    @keydown.esc="hide()"
    @mouseenter="trigger === 'hover' && show()"
    @mouseleave="trigger === 'hover' && hide()"
  >
    <slot />
    <div
      v-if="open"
      role="group"
      :aria-label="t('dropdown.aria')"
      class="absolute z-panel min-w-44 rounded-surface border border-line bg-surface p-2xs shadow-pop"
      :class="placementClass(placement)"
      @click.stop
    >
      <OsMenu ref="menuRef" :items="items" mode="vertical" @click="onMenuClick" />
    </div>
  </span>
</template>
