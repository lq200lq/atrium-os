import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import { idbGet, idbSet } from '../fs/idb'
import { LOCALES, setLocale, type Locale } from '@/i18n'

const SETTINGS_KEY = 'settings-v1'

/**
 * 用户可调的壳层偏好。Dock 固定项以「覆盖表」表达：
 * 未在表中的应用沿用 manifest.dock 默认；表内 true/false 为用户显式固定/取消。
 */
export const useSettings = defineStore('settings', {
  state: () => ({
    dockPinned: {} as Record<string, boolean>,
    lang: 'zh-CN' as Locale,
  }),
  actions: {
    isPinned(appId: string, manifestDefault: boolean): boolean {
      return this.dockPinned[appId] ?? manifestDefault
    },

    togglePinned(appId: string, manifestDefault: boolean) {
      const next = !this.isPinned(appId, manifestDefault)
      // 与默认一致则移除覆盖，保持覆盖表最小
      if (next === manifestDefault) delete this.dockPinned[appId]
      else this.dockPinned[appId] = next
      void this.persist()
    },

    resetDock() {
      this.dockPinned = {}
      void this.persist()
    },

    setLang(lang: Locale) {
      if (!LOCALES.includes(lang)) return
      this.lang = lang
      setLocale(lang)
      void this.persist()
    },

    async persist() {
      try {
        await idbSet(SETTINGS_KEY, { dockPinned: toRaw(this.dockPinned), lang: this.lang })
      } catch (e) {
        console.warn('[settings] 持久化失败', e)
      }
    },

    async restore() {
      try {
        const saved = await idbGet<{ dockPinned?: unknown; lang?: unknown }>(SETTINGS_KEY)
        if (saved && saved.dockPinned && typeof saved.dockPinned === 'object') {
          this.dockPinned = { ...(saved.dockPinned as Record<string, boolean>) }
        }
        if (saved && typeof saved.lang === 'string' && LOCALES.includes(saved.lang as Locale)) {
          this.lang = saved.lang as Locale
          setLocale(this.lang)
        }
      } catch (e) {
        console.warn('[settings] 恢复失败', e)
      }
    },
  },
})
