<script setup lang="ts">
import { computed } from 'vue'
import OsIcon from '@/components/OsIcon.vue'
import { useAppRegistry } from '@/kernel/stores/appRegistry'
import { useSession, USERS } from '@/kernel/stores/session'
import { useSettings } from '@/kernel/stores/settings'
import { useTheme, WALLPAPER_KEYS } from '@/kernel/stores/theme'
import { useWindowManager } from '@/kernel/stores/windowManager'
import OsButton from '@/ui/OsButton.vue'

const session = useSession()
const settings = useSettings()
const theme = useTheme()
const registry = useAppRegistry()
const wm = useWindowManager()

const rolesText = computed(() => session.currentRoles.map((r) => r.name).join('、') || '无')
const permsText = computed(() => {
  const perms = session.effectivePermissions
  return perms.includes('*') ? '全部权限' : perms.length ? perms.join('、') : '仅公开应用'
})

const wallpaperLabel: Record<string, string> = {
  'wallpaper-sky': '晴空',
  'wallpaper-dusk': '黄昏',
  'wallpaper-jade': '翡翠',
}

function resetLayout() {
  const ids = wm.windows.map((w) => w.id)
  for (const id of ids) wm.close(id)
}
</script>

<template>
  <div class="h-full overflow-y-auto text-ui text-ink">
    <!-- 用户与角色 -->
    <section class="border-b border-slate-200/70 p-4">
      <h2 class="mb-1 flex items-center gap-1.5 text-title font-medium">
        <OsIcon name="user" :size="15" class="text-accent-strong" /> 用户与角色
      </h2>
      <p class="mb-3 text-caption text-ink-mute">
        切换用户即切换权限集合，Dock / 应用中心 / Spotlight 的可见应用随之变化。
      </p>
      <div class="flex flex-col gap-2">
        <button
          v-for="u in USERS"
          :key="u.id"
          class="flex items-center justify-between rounded-lg border px-3 py-2 text-left transition"
          :class="
            session.currentUserId === u.id
              ? 'border-accent bg-accent-soft'
              : 'border-slate-200 hover:bg-slate-50'
          "
          @click="session.setUser(u.id)"
        >
          <span>
            <span class="block font-medium">{{ u.name }}</span>
            <span class="block text-caption text-ink-mute">{{ u.desc }}</span>
          </span>
          <OsIcon
            v-if="session.currentUserId === u.id"
            name="check"
            :size="16"
            class="text-accent-strong"
          />
        </button>
      </div>
      <p class="mt-2 text-caption text-ink-mute">
        当前角色：{{ rolesText }} ｜ 权限：{{ permsText }}
      </p>
    </section>

    <!-- 外观 -->
    <section class="border-b border-slate-200/70 p-4">
      <h2 class="mb-3 flex items-center gap-1.5 text-title font-medium">
        <OsIcon name="sparkles" :size="15" class="text-accent-strong" /> 外观
      </h2>
      <div class="flex items-center gap-2">
        <span class="text-ink-mute">壁纸：{{ wallpaperLabel[theme.wallpaper] }}</span>
        <OsButton size="sm" @click="theme.cycleWallpaper()">切换壁纸</OsButton>
      </div>
      <p class="mt-2 text-caption text-ink-mute">明暗主题与强调色将在 S5 主题纵深阶段接入。</p>
    </section>

    <!-- Dock 固定项 -->
    <section class="border-b border-slate-200/70 p-4">
      <h2 class="mb-1 flex items-center gap-1.5 text-title font-medium">
        <OsIcon name="boxes" :size="15" class="text-accent-strong" /> Dock 固定项
      </h2>
      <p class="mb-3 text-caption text-ink-mute">
        勾选决定应用是否固定在 Dock（不影响可访问性，仅影响展示）。
      </p>
      <div class="grid grid-cols-2 gap-2">
        <label
          v-for="app in registry.accessibleApps"
          :key="app.id"
          class="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
        >
          <input
            type="checkbox"
            :checked="settings.isPinned(app.id, app.dock !== false)"
            @change="settings.togglePinned(app.id, app.dock !== false)"
          />
          <OsIcon :name="app.icon" :size="16" class="text-ink-mute" />
          <span>{{ app.name }}</span>
        </label>
      </div>
      <OsButton size="sm" class="mt-3" @click="settings.resetDock()">恢复默认固定项</OsButton>
    </section>

    <!-- 窗口 -->
    <section class="border-b border-slate-200/70 p-4">
      <h2 class="mb-3 flex items-center gap-1.5 text-title font-medium">
        <OsIcon name="puzzle" :size="15" class="text-accent-strong" /> 窗口
      </h2>
      <div class="flex gap-2">
        <OsButton size="sm" @click="wm.cascadeAll()">层叠全部窗口</OsButton>
        <OsButton size="sm" variant="danger" @click="resetLayout">关闭全部窗口</OsButton>
      </div>
    </section>

    <!-- 系统信息 -->
    <section class="p-4">
      <h2 class="mb-3 flex items-center gap-1.5 text-title font-medium">
        <OsIcon name="shield" :size="15" class="text-accent-strong" /> 系统信息
      </h2>
      <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-caption">
        <dt class="text-ink-mute">WebOS 版本</dt>
        <dd>0.0.1</dd>
        <dt class="text-ink-mute">已注册应用</dt>
        <dd>{{ registry.apps.length }}</dd>
        <dt class="text-ink-mute">当前可访问</dt>
        <dd>{{ registry.accessibleApps.length }}</dd>
        <dt class="text-ink-mute">壁纸候选</dt>
        <dd>{{ WALLPAPER_KEYS.length }}</dd>
      </dl>
    </section>
  </div>
</template>
