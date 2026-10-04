import { defineAsyncComponent, markRaw, type Component } from 'vue'
import { defineStore } from 'pinia'
import type { IconName } from '../icons'

export interface AppWindowSpec {
  w: number
  h: number
  minW?: number
  minH?: number
}

export type AppCategory = 'system' | 'productivity' | 'data' | 'settings' | 'other'

export interface AppManifest {
  id: string
  name: string
  icon: IconName
  tint?: string
  entry: () => Promise<Component>
  window: AppWindowSpec
  singleton?: boolean
  dock?: boolean
  keywords?: string[]
  /** 语义化版本，用于文档站与 CHANGELOG（S6 消费） */
  version?: string
  /** 应用分类，应用中心分组展示（可选，缺省 other） */
  category?: AppCategory
  /** 访问所需权限点集合；为空表示公开（S2 消费） */
  permissions?: string[]
  /** i18n 文案 key，回退到 name（S5 消费） */
  nameKey?: string
  /** 注册排序权重，越小越靠前；缺省 100，Dock/应用中心/Spotlight 均据此排序 */
  order?: number
}

export interface RegisteredApp extends AppManifest {
  component: Component
}

const DEFAULT_ORDER = 100

function orderOf(app: { order?: number }): number {
  return app.order ?? DEFAULT_ORDER
}

export const useAppRegistry = defineStore('appRegistry', {
  state: () => ({
    apps: [] as RegisteredApp[],
  }),
  getters: {
    dockApps: (state) => state.apps.filter((a) => a.dock !== false),
    byId: (state) => (id: string) => state.apps.find((a) => a.id === id),
  },
  actions: {
    register(manifest: AppManifest) {
      if (this.apps.some((a) => a.id === manifest.id)) return
      const app: RegisteredApp = {
        ...manifest,
        component: markRaw(defineAsyncComponent(manifest.entry)),
      }
      // 按 order 升序插入（稳定：同权重保持先注册在前），使派生入口排序不依赖 import 顺序
      const at = this.apps.findIndex((a) => orderOf(a) > orderOf(app))
      if (at === -1) this.apps.push(app)
      else this.apps.splice(at, 0, app)
    },
  },
})
