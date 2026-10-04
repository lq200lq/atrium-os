import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import { idbGet, idbSet } from '../fs/idb'
import { clamp, clampRect, desktopBounds, type Rect } from '../layout'
import { useAppRegistry } from './appRegistry'

const LAYOUT_KEY = 'layout-v1'

export type WinStatus = 'normal' | 'maximized' | 'minimized'

export interface WinState extends Rect {
  id: string
  appId: string
  title: string
  z: number
  status: WinStatus
  prevRect?: Rect
  payload?: unknown
}

interface SavedWin {
  appId: string
  title: string
  x: number
  y: number
  w: number
  h: number
  z: number
  status: WinStatus
  prevRect?: Rect
  payload?: unknown
}

let seq = 0
let persistTimer: ReturnType<typeof setTimeout> | undefined

function payloadKey(payload: unknown): string | undefined {
  if (payload && typeof payload === 'object' && 'key' in payload) {
    return String((payload as { key: unknown }).key)
  }
  return undefined
}

function topMost(windows: WinState[]): WinState | undefined {
  return [...windows].sort((a, b) => a.z - b.z).pop()
}

export const useWindowManager = defineStore('windowManager', {
  state: () => ({
    windows: [] as WinState[],
    topZ: 10,
    activeId: null as string | null,
  }),
  getters: {
    byId: (state) => (id: string) => state.windows.find((w) => w.id === id),
    isRunning: (state) => (appId: string) => state.windows.some((w) => w.appId === appId),
  },
  actions: {
    open(appId: string, payload?: unknown): string | null {
      const manifest = useAppRegistry().byId(appId)
      if (!manifest) return null

      const key = payloadKey(payload)
      const reusable =
        manifest.singleton || key !== undefined
          ? this.windows.find((w) => w.appId === appId && payloadKey(w.payload) === key)
          : undefined
      if (reusable) {
        if (payload !== undefined) reusable.payload = payload
        if (reusable.status === 'minimized') reusable.status = 'normal'
        this.focus(reusable.id)
        return reusable.id
      }

      seq += 1
      const bounds = desktopBounds()
      const w = Math.min(manifest.window.w, bounds.w - 16)
      const h = Math.min(manifest.window.h, bounds.h - 16)
      const cascade = (seq % 6) * 28
      const win: WinState = {
        id: `win-${seq}`,
        appId,
        title: manifest.name,
        x: clamp(bounds.x + 140 + cascade, 8, Math.max(8, bounds.w - w - 8)),
        y: clamp(bounds.y + 48 + cascade, bounds.y + 4, Math.max(bounds.y + 4, bounds.y + bounds.h - h - 8)),
        w,
        h,
        z: 0,
        status: 'normal',
        payload,
      }
      this.windows.push(win)
      this.focus(win.id)
      return win.id
    },

    close(id: string) {
      const idx = this.windows.findIndex((w) => w.id === id)
      if (idx === -1) return
      this.windows.splice(idx, 1)
      if (this.activeId === id) {
        this.activeId = topMost(this.windows.filter((w) => w.status !== 'minimized'))?.id ?? null
      }
    },

    focus(id: string) {
      const win = this.byId(id)
      if (!win) return
      this.topZ += 1
      win.z = this.topZ
      this.activeId = id
    },

    blur() {
      this.activeId = null
    },

    setTitle(id: string, title: string) {
      const win = this.byId(id)
      if (win) win.title = title
    },

    setPayload(id: string, payload: unknown) {
      const win = this.byId(id)
      if (win) win.payload = payload
    },

    restore(id: string) {
      const win = this.byId(id)
      if (!win) return
      win.status = 'normal'
      this.focus(id)
    },

    minimize(id: string) {
      const win = this.byId(id)
      if (!win) return
      win.status = 'minimized'
      if (this.activeId === id) {
        this.activeId =
          topMost(this.windows.filter((w) => w.status !== 'minimized' && w.id !== id))?.id ?? null
      }
    },

    toggleMax(id: string) {
      const win = this.byId(id)
      if (!win) return
      if (win.status === 'maximized') {
        win.status = 'normal'
        if (win.prevRect) Object.assign(win, win.prevRect)
        win.prevRect = undefined
      } else {
        win.prevRect = { x: win.x, y: win.y, w: win.w, h: win.h }
        Object.assign(win, desktopBounds(), { status: 'maximized' })
      }
      this.focus(id)
    },

    move(id: string, x: number, y: number) {
      const win = this.byId(id)
      if (!win || win.status === 'maximized') return
      const r = clampRect({ x, y, w: win.w, h: win.h }, win.w, win.h)
      win.x = r.x
      win.y = r.y
    },

    resize(id: string, rect: Rect) {
      const win = this.byId(id)
      if (!win || win.status === 'maximized') return
      const spec = useAppRegistry().byId(win.appId)?.window
      const r = clampRect(rect, spec?.minW ?? 320, spec?.minH ?? 200)
      Object.assign(win, r)
    },

    cascadeAll() {
      const bounds = desktopBounds()
      let i = 0
      for (const win of this.windows.filter((w) => w.status === 'normal')) {
        const c = (i++ % 6) * 28
        win.x = clamp(bounds.x + 140 + c, 8, Math.max(8, bounds.w - win.w - 8))
        win.y = clamp(bounds.y + 48 + c, bounds.y + 4, Math.max(bounds.y + 4, bounds.y + bounds.h - win.h - 8))
      }
    },

    schedulePersist() {
      if (persistTimer) clearTimeout(persistTimer)
      persistTimer = setTimeout(() => void this.persistLayout(), 400)
    },

    async persistLayout() {
      const snapshot: SavedWin[] = this.windows.map((w) => ({
        appId: w.appId,
        title: w.title,
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        z: w.z,
        status: w.status,
        prevRect: w.prevRect ? { ...w.prevRect } : undefined,
        payload: w.payload === undefined ? undefined : toRaw(w.payload),
      }))
      try {
        await idbSet(LAYOUT_KEY, snapshot)
      } catch (e) {
        console.warn('[wm] 布局持久化失败', e)
      }
    },

    async restoreLayout() {
      try {
        const saved = await idbGet<SavedWin[]>(LAYOUT_KEY)
        if (!saved || saved.length === 0) return
        const registry = useAppRegistry()
        const restored: WinState[] = []
        let maxZ = this.topZ
        for (const s of saved) {
          const manifest = registry.byId(s.appId)
          if (!manifest) continue
          seq += 1
          maxZ = Math.max(maxZ, s.z)
          restored.push({
            id: `win-${seq}`,
            appId: s.appId,
            title: s.title || manifest.name,
            x: s.x,
            y: s.y,
            w: s.w,
            h: s.h,
            z: s.z,
            status: s.status,
            prevRect: s.prevRect,
            payload: s.payload,
          })
        }
        this.windows = restored
        this.topZ = maxZ + 1
        this.activeId =
          [...restored].filter((w) => w.status !== 'minimized').sort((a, b) => a.z - b.z).pop()?.id ??
          null
      } catch (e) {
        console.warn('[wm] 布局恢复失败', e)
      }
    },
  },
})
