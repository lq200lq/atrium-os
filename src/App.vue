<script setup lang="ts">
import { defineAsyncComponent, onMounted, onUnmounted } from 'vue'
import ContextMenu from '@/shell/ContextMenu.vue'
import Desktop from '@/shell/Desktop.vue'
import Dock from '@/shell/Dock.vue'
import FeedbackHost from '@/shell/FeedbackHost.vue'
import NotificationCenter from '@/shell/NotificationCenter.vue'
import Spotlight from '@/shell/Spotlight.vue'
import TopBar from '@/shell/TopBar.vue'
import WidgetLayer from '@/shell/WidgetLayer.vue'
import OsToast from '@/ui/OsToast.vue'
import WindowManager from '@/windows/WindowManager.vue'
import { useShellUi } from '@/kernel/stores/shellUi'

// 小组件库只有开抽屉时才用得到，异步化以免把表单件塞进首屏入口
const WidgetGallery = defineAsyncComponent(() => import('@/shell/WidgetGallery.vue'))

const ui = useShellUi()

function onKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    // ⌘K/ctrl+K 是开合开关（S12 键盘契约：浮层必须可以从键盘原路退出）
    if (ui.spotlightOpen) ui.closeOverlays()
    else ui.openSpotlight()
  }
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
    // 「显示桌面」与顶栏按钮同一个开关（解 E10 的键盘出口）
    e.preventDefault()
    ui.toggleDesktopReveal()
  }
  if (e.key === 'Escape' && ui.configInstanceId) {
    // 配置弹层自带 Esc 语义时也只走这一条：焦点在弹层内按 Esc 关层
    ui.closeWidgetConfig()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="fixed inset-0 select-none overflow-hidden">
    <FeedbackHost>
      <Desktop />
      <!-- 右键菜单是单例浮层：挂根级才能越过小组件层的层叠上下文（否则会被窗口盖住） -->
      <ContextMenu />
      <WidgetLayer />
      <WindowManager />
      <TopBar />
      <Dock />
      <NotificationCenter />
      <WidgetGallery />
      <Spotlight />
      <OsToast />
    </FeedbackHost>
  </div>
</template>
