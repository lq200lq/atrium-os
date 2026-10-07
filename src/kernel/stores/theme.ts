import { defineStore } from 'pinia'
import { idbGet, idbSet } from '../fs/idb'
import { persistBoundary } from './persistHelper'

const THEME_KEY = 'theme-v1'
const THEME_VERSION = 2

export const WALLPAPER_KEYS = ['wallpaper-sky', 'wallpaper-dusk', 'wallpaper-jade'] as const
export type WallpaperKey = (typeof WALLPAPER_KEYS)[number]

export const MODES = ['light', 'dark'] as const
export type ThemeMode = (typeof MODES)[number]

export const ACCENT_KEYS = ['sky', 'violet', 'emerald', 'rose'] as const
export type AccentKey = (typeof ACCENT_KEYS)[number]

function isWallpaper(v: unknown): v is WallpaperKey {
  return typeof v === 'string' && (WALLPAPER_KEYS as readonly string[]).includes(v)
}
function isMode(v: unknown): v is ThemeMode {
  return v === 'light' || v === 'dark'
}
function isAccent(v: unknown): v is AccentKey {
  return typeof v === 'string' && (ACCENT_KEYS as readonly string[]).includes(v)
}

interface PersistedTheme {
  version?: number
  wallpaper?: unknown
  mode?: unknown
  accent?: unknown
}

export const useTheme = defineStore('theme', {
  state: () => ({
    wallpaper: 'wallpaper-sky' as WallpaperKey,
    mode: 'light' as ThemeMode,
    accent: 'sky' as AccentKey,
  }),
  actions: {
    /** 把 mode/accent 落到根元素 data-*，驱动 theme-dark.css / 强调色预设 */
    apply() {
      const root = document.documentElement
      root.dataset.theme = this.mode
      root.dataset.accent = this.accent
    },

    cycleWallpaper() {
      const i = WALLPAPER_KEYS.indexOf(this.wallpaper)
      this.wallpaper = WALLPAPER_KEYS[(i + 1) % WALLPAPER_KEYS.length]
      void this.persist()
    },

    /** 直接落到某一档（快捷设置件用）：cycle 只能轮转，选不了目标档 */
    setWallpaper(key: WallpaperKey) {
      if (this.wallpaper === key) return
      this.wallpaper = key
      void this.persist()
    },

    setMode(mode: ThemeMode) {
      this.mode = mode
      this.apply()
      void this.persist()
    },

    toggleMode() {
      this.setMode(this.mode === 'dark' ? 'light' : 'dark')
    },

    setAccent(accent: AccentKey) {
      this.accent = accent
      this.apply()
      void this.persist()
    },

    async persist() {
      await persistBoundary('theme', '持久化失败', () =>
        idbSet(THEME_KEY, {
          version: THEME_VERSION,
          wallpaper: this.wallpaper,
          mode: this.mode,
          accent: this.accent,
        }),
      )
    },

    async restore() {
      await persistBoundary('theme', '恢复失败', async () => {
        const saved = await idbGet<PersistedTheme>(THEME_KEY)
        // 迁移：旧数据（无 version）只有 wallpaper，mode/accent 取缺省
        if (saved) {
          if (isWallpaper(saved.wallpaper)) this.wallpaper = saved.wallpaper
          if (isMode(saved.mode)) this.mode = saved.mode
          if (isAccent(saved.accent)) this.accent = saved.accent
        }
      })
      this.apply()
    },
  },
})
