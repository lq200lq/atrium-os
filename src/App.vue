<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import Desktop from '@/shell/Desktop.vue'
import Dock from '@/shell/Dock.vue'
import FeedbackHost from '@/shell/FeedbackHost.vue'
import NotificationCenter from '@/shell/NotificationCenter.vue'
import Spotlight from '@/shell/Spotlight.vue'
import TopBar from '@/shell/TopBar.vue'
import Widgets from '@/shell/Widgets.vue'
import OsToast from '@/ui/OsToast.vue'
import WindowManager from '@/windows/WindowManager.vue'
import { useShellUi } from '@/kernel/stores/shellUi'

const ui = useShellUi()

function onKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    // ⌘K/ctrl+K 是开合开关（S12 键盘契约：浮层必须可以从键盘原路退出）
    if (ui.spotlightOpen) ui.closeOverlays()
    else ui.openSpotlight()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="fixed inset-0 select-none overflow-hidden">
    <FeedbackHost>
      <Desktop />
      <Widgets />
      <WindowManager />
      <TopBar />
      <Dock />
      <NotificationCenter />
      <Spotlight />
      <OsToast />
    </FeedbackHost>
  </div>
</template>
