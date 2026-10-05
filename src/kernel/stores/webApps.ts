import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import { idbGet, idbSet } from '../fs/idb'
import { normalizeWebUrl } from '../webapp/url'
import { useAppRegistry, type AppManifest } from './appRegistry'
import { useWindowManager } from './windowManager'

const WEBAPPS_KEY = 'webapps-v1'

/** 一条用户添加的网页应用记录（IDB 里只存这个，不存组件） */
export interface WebAppRecord {
  id: string
  name: string
  url: string
  addedAt: number
}

const MAX_NAME = 24

/** host → id 片段：只留字母数字，其余（点、连字符、中文 punycode 边界）统一压成单横杠 */
function hostSlug(host: string): string {
  return host
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** id 冲突时加数字后缀；内置应用与其它用户应用都不能撞（撞了 byId 会返回先注册的那个） */
function uniqueId(host: string, taken: (id: string) => boolean): string {
  const base = `web-${hostSlug(host) || 'site'}`
  if (!taken(base)) return base
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`
    if (!taken(candidate)) return candidate
  }
  return `web-${Date.now()}`
}

export type AddResult =
  { ok: true; record: WebAppRecord } | { ok: false; reason: 'bad-url' | 'bad-name' }

export const useWebApps = defineStore('webApps', {
  state: () => ({
    items: [] as WebAppRecord[],
  }),
  getters: {
    /** 用户添加的应用：注册表里存在但不在本列表的一律视为内置 */
    isUserApp: (state) => (id: string) => state.items.some((r) => r.id === id),
    byId: (state) => (id: string) => state.items.find((r) => r.id === id),
  },
  actions: {
    /** 记录 → manifest：网页应用没有 entry，只有 embed，渲染组件由 registry 合成 */
    toManifest(rec: WebAppRecord): AppManifest {
      const host = normalizeWebUrl(rec.url)
      return {
        id: rec.id,
        name: rec.name,
        icon: 'globe',
        embed: { url: rec.url },
        window: { w: 900, h: 620, minW: 420, minH: 320 },
        // 外部站点由第三方持有状态，多开没有意义；且用户应用不给权限位（对所有角色可见）
        singleton: true,
        permissions: [],
        order: 100,
        keywords: [host.ok ? host.host : rec.id],
      }
    },

    add(rawName: string, rawUrl: string): AddResult {
      const name = rawName.trim()
      if (!name || name.length > MAX_NAME) return { ok: false, reason: 'bad-name' }
      const parsed = normalizeWebUrl(rawUrl)
      if (!parsed.ok) return { ok: false, reason: 'bad-url' }

      const registry = useAppRegistry()
      const taken = (id: string) =>
        registry.byId(id) !== undefined || this.items.some((r) => r.id === id)
      const rec: WebAppRecord = {
        id: uniqueId(parsed.host, taken),
        name,
        url: parsed.url,
        addedAt: Date.now(),
      }
      this.items.push(rec)
      registry.register(this.toManifest(rec))
      void this.persist('添加')
      return { ok: true, record: rec }
    },

    update(id: string, rawName: string, rawUrl: string): AddResult {
      const rec = this.items.find((r) => r.id === id)
      if (!rec) return { ok: false, reason: 'bad-url' }
      const name = rawName.trim()
      if (!name || name.length > MAX_NAME) return { ok: false, reason: 'bad-name' }
      const parsed = normalizeWebUrl(rawUrl)
      if (!parsed.ok) return { ok: false, reason: 'bad-url' }

      rec.name = name
      rec.url = parsed.url
      // id 由 host 派生但一旦分配就稳定：改地址不换 id，否则 Dock 固定项与已存布局会指向幽灵应用
      const registry = useAppRegistry()
      registry.unregister(id)
      registry.register(this.toManifest(rec))
      void this.persist('更新')
      return { ok: true, record: rec }
    },

    remove(id: string) {
      const idx = this.items.findIndex((r) => r.id === id)
      if (idx === -1) return
      this.items.splice(idx, 1)
      const wm = useWindowManager()
      // 必须先关窗：窗口还活着而注册表已无此 appId 时，WindowFrame 的 manifest 变 undefined，
      // <component :is> 直接渲染成空白窗口（布局里还会留一条复活记录）
      for (const win of [...wm.windows]) if (win.appId === id) wm.close(win.id)
      useAppRegistry().unregister(id)
      void this.persist('卸载')
    },

    async persist(op: string) {
      try {
        await idbSet(WEBAPPS_KEY, toRaw(this.items))
      } catch (e) {
        console.warn(`[webapps] ${op}持久化失败`, e)
      }
    },

    /** 只还原数据，注册由 main.ts 完成（注册必须在 wm.restoreLayout 之前） */
    async restore() {
      try {
        const saved = await idbGet<unknown>(WEBAPPS_KEY)
        if (!Array.isArray(saved)) return
        const clean: WebAppRecord[] = []
        for (const raw of saved) {
          if (!raw || typeof raw !== 'object') continue
          const r = raw as Record<string, unknown>
          if (typeof r.id !== 'string' || typeof r.name !== 'string') continue
          // 落库后地址仍要过一遍校验：IDB 可被手改，渲染面不接受未归一地址
          const parsed = normalizeWebUrl(String(r.url ?? ''))
          if (!parsed.ok) continue
          clean.push({ id: r.id, name: r.name, url: parsed.url, addedAt: Number(r.addedAt) || 0 })
        }
        this.items = clean
      } catch (e) {
        console.warn('[webapps] 恢复失败', e)
      }
    },
  },
})
