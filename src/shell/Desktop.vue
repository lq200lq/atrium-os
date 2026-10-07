<script setup lang="ts">
import { computed, nextTick, onMounted, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOS } from '@/kernel/composables/useOS'
import { useShellUi, type ContextMenuItem } from '@/kernel/stores/shellUi'
import { useTheme } from '@/kernel/stores/theme'
import { useWidgetRuntime } from '@/kernel/stores/widgetRuntime'
import { useWindowManager } from '@/kernel/stores/windowManager'

const wm = useWindowManager()
const theme = useTheme()
const ui = useShellUi()
const os = useOS()
const runtime = useWidgetRuntime()
const { t } = useI18n()

/**
 * 标语让位（解 E18）：件占到第二个 band 起，大字标语会压进摆放域，因此淡出——
 * 同一句话常驻顶栏小字，装饰性重复退场不构成信息损失（决策 12）。
 *
 * band 数在**窄窗口**下不够用：只剩一个 band 时摆放域本身就已横切到左侧标语上方，
 * `bandsUsed` 仍是 1。于是再加一条按真实矩形相交的兜底——摆放域的外接矩形由几何权威
 * （WidgetLayer）同源写给 `runtime.usedRect`，这里只量**自己**这一块的盒子。
 */
const sloganEl = ref<HTMLElement | null>(null)
const overlapsWidgets = ref(false)

function measureOverlap() {
  const el = sloganEl.value
  const used = runtime.usedRect
  if (!el || !used) {
    overlapsWidgets.value = false
    return
  }
  const box = el.getBoundingClientRect()
  overlapsWidgets.value =
    box.left < used.x + used.w &&
    used.x < box.right &&
    box.top < used.y + used.h &&
    used.y < box.bottom
}

let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  measureOverlap()
  // 换语言 / 字体异步到位都会改标语盒子的宽度，量一次不够
  if (sloganEl.value) {
    resizeObserver = new ResizeObserver(measureOverlap)
    resizeObserver.observe(sloganEl.value)
  }
})
watch(
  () => [runtime.usedRect, t('brand.slogan')],
  () => nextTick(measureOverlap),
)
onScopeDispose(() => resizeObserver?.disconnect())

const sloganHidden = computed(() => runtime.bandsUsed >= 2 || overlapsWidgets.value)

/** 桌面空白处的一级动作；条目交给壳层菜单宿主渲染（单例，见 `shellUi.contextMenu`） */
const items = computed<ContextMenuItem[]>(() => [
  { key: 'context.widgets', label: t('context.widgets'), run: () => ui.openWidgetGallery() },
  { key: 'context.cascade', label: t('context.cascade'), run: () => wm.cascadeAll() },
  { key: 'context.wallpaper', label: t('context.wallpaper'), run: () => theme.cycleWallpaper() },
  {
    key: 'context.appCenter',
    label: t('context.appCenter'),
    run: () => os.exec('app-center:open'),
  },
])

function onDesktopDown() {
  wm.blur()
  // 速览态下点桌面即还原：窗口层透明时它是唯一还吃得动指针的桌面区域
  if (ui.desktopRevealed) ui.setDesktopRevealed(false)
}

function onContext(e: MouseEvent) {
  ui.openContextMenu(e.clientX, e.clientY, items.value)
}
</script>

<template>
  <div
    class="absolute inset-0"
    :class="theme.wallpaper"
    @pointerdown.self="onDesktopDown"
    @contextmenu.prevent="onContext"
  >
    <div
      ref="sloganEl"
      data-desktop-slogan
      class="wallpaper-slogan absolute left-12 top-[36%] text-white drop-shadow-lg transition duration-base"
      :class="sloganHidden ? 'opacity-0' : 'opacity-100'"
    >
      <p class="text-display-1 italic tracking-wide">{{ t('brand.slogan') }}</p>
      <p class="mt-3 text-display-3 italic tracking-widest">{{ t('brand.tagline') }}</p>
    </div>
  </div>
</template>
