<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import OsBadge from '@/ui/OsBadge.vue'
import OsDropdown from '@/ui/OsDropdown.vue'
import { useOS } from '@/kernel/composables/useOS'
import { useNotification } from '@/kernel/stores/notification'
import { useSettings } from '@/kernel/stores/settings'
import { useShellUi } from '@/kernel/stores/shellUi'
import type { MenuItem } from '@/ui/types'

const ui = useShellUi()
const notif = useNotification()
const settings = useSettings()
const os = useOS()
const { t } = useI18n()

const now = ref(new Date())
const timer = setInterval(() => (now.value = new Date()), 1000)
onUnmounted(() => clearInterval(timer))

const time = () =>
  now.value.toLocaleTimeString(settings.lang, { hour: '2-digit', minute: '2-digit', hour12: false })
const date = () =>
  now.value.toLocaleDateString(settings.lang, { month: 'long', day: 'numeric', weekday: 'short' })

/* 顶栏只留两个真有动作的下拉（此前七个菜单全是无 onClick 的死按钮）。
 * 其余菜单语义在组件陈列的菜单 demo 里仍有展示，locale 键不删。 */
const viewOpen = ref(false)
const helpOpen = ref(false)

const viewItems = computed<MenuItem[]>(() => [
  {
    key: 'toggle-desktop',
    // 勾选态：MenuItem 无 checked 位，用 ✓ 前缀表达（受控显示，切换即消）
    label: `${ui.desktopRevealed ? '✓ ' : ''}${t('context.showDesktop')}`,
  },
])
const helpItems = computed<MenuItem[]>(() => [
  { key: 'about', label: t('topbar.about') },
  { key: 'docs', label: t('apps.docsCenter') },
])

function onViewPick(key: string) {
  if (key === 'toggle-desktop') ui.toggleDesktopReveal()
}

function onHelpPick(key: string) {
  if (key === 'about') os.exec('settings:open', { section: 'system' })
  else if (key === 'docs') os.exec('docs-center:open')
}
</script>

<template>
  <header
    class="fixed inset-x-0 top-0 z-shell flex h-11 items-center gap-3 border-b border-glass-border bg-glass-bar px-4 backdrop-blur-xl"
  >
    <div class="flex shrink-0 items-center gap-2 whitespace-nowrap">
      <div
        class="flex h-6 w-6 items-center justify-center rounded-control bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow"
      >
        <OsIcon name="boxes" :size="14" />
      </div>
      <span class="text-ui font-strong text-ink-strong">{{ t('brand.slogan') }}</span>
    </div>

    <nav class="flex shrink-0 items-center gap-2xs">
      <OsDropdown v-model:open="viewOpen" :items="viewItems" @click="onViewPick">
        <button
          class="inline-flex h-control-sm items-center whitespace-nowrap rounded-chip px-xs text-ui text-ink hover:bg-glass-raise"
          aria-haspopup="menu"
          :aria-expanded="viewOpen"
        >
          {{ t('topbar.menus.view') }}
        </button>
      </OsDropdown>
      <OsDropdown v-model:open="helpOpen" :items="helpItems" @click="onHelpPick">
        <button
          class="inline-flex h-control-sm items-center whitespace-nowrap rounded-chip px-xs text-ui text-ink hover:bg-glass-raise"
          aria-haspopup="menu"
          :aria-expanded="helpOpen"
        >
          {{ t('topbar.menus.help') }}
        </button>
      </OsDropdown>
    </nav>

    <div class="min-w-0 flex-1 px-4">
      <button
        class="flex w-full max-w-[var(--container-md)] items-center gap-2 rounded-full border border-glass-border bg-glass-raise px-4 py-1 text-left text-ui text-ink-mute hover:bg-glass-base"
        @click="ui.openSpotlight()"
      >
        <OsIcon name="search" :size="14" class="text-ink-mute" />
        <span class="flex-1 truncate">{{ t('topbar.search') }}</span>
        <kbd class="rounded-chip border border-line px-1 text-micro text-ink-mute">⌘K</kbd>
      </button>
    </div>

    <div class="flex shrink-0 items-center gap-3 whitespace-nowrap text-ui text-ink">
      <!-- 桌面速览（解 E10）：窗口层整体透明化，再点或点桌面还原；快捷键 ⌘⇧D 同开关 -->
      <button
        type="button"
        class="inline-flex h-control-sm items-center gap-2xs rounded-chip px-xs text-ink-mute transition duration-quick hover:bg-glass-raise hover:text-ink"
        :class="ui.desktopRevealed ? 'bg-glass-raise text-ink' : ''"
        :aria-label="t('context.showDesktop')"
        :aria-pressed="ui.desktopRevealed"
        :title="`${t('context.showDesktop')} ⌘⇧D`"
        @click="ui.toggleDesktopReveal()"
      >
        <OsIcon name="layout-grid" :size="16" />
      </button>
      <button
        type="button"
        class="relative"
        :aria-label="t('notification.title')"
        :aria-expanded="ui.notificationsOpen"
        @click="ui.toggleNotifications()"
      >
        <OsIcon name="bell" :size="16" />
        <OsBadge class="absolute -right-1.5 -top-1" :count="notif.unread" />
      </button>
      <span class="tabular-nums">{{ time() }} {{ date() }}</span>
    </div>
  </header>
</template>
