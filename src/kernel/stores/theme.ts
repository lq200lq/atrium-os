import { defineStore } from 'pinia'
import { idbGet, idbSet } from '../fs/idb'

const THEME_KEY = 'theme-v1'

export const WALLPAPER_KEYS = ['wallpaper-sky', 'wallpaper-dusk', 'wallpaper-jade'] as const
export type WallpaperKey = (typeof WALLPAPER_KEYS)[number]

function isWallpaper(v: unknown): v is WallpaperKey {
  return typeof v === 'string' && (WALLPAPER_KEYS as readonly string[]).includes(v)
}

export const useTheme = defineStore('theme', {
  state: () => ({
    wallpaper: 'wallpaper-sky' as WallpaperKey,
  }),
  actions: {
    cycleWallpaper() {
      const i = WALLPAPER_KEYS.indexOf(this.wallpaper)
      this.wallpaper = WALLPAPER_KEYS[(i + 1) % WALLPAPER_KEYS.length]
      void this.persist()
    },

    async persist() {
      try {
        await idbSet(THEME_KEY, { wallpaper: this.wallpaper })
      } catch (e) {
        console.warn('[theme] 持久化失败', e)
      }
    },

    async restore() {
      try {
        const saved = await idbGet<{ wallpaper?: unknown }>(THEME_KEY)
        if (saved && isWallpaper(saved.wallpaper)) this.wallpaper = saved.wallpaper
      } catch (e) {
        console.warn('[theme] 恢复失败', e)
      }
    },
  },
})
