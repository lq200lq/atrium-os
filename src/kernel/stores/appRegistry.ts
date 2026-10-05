import { defineAsyncComponent, markRaw, type Component } from 'vue'
import { defineStore } from 'pinia'
import type { IconName } from '../icons'
import { useSession } from './session'
import { useSettings } from './settings'

export interface AppWindowSpec {
  w: number
  h: number
  minW?: number
  minH?: number
}

export type AppCategory = 'system' | 'productivity' | 'data' | 'settings' | 'other'

type EntryFn = () => Promise<Component>

/** 外部网页应用的嵌入规格；与 entry 互斥，由 register() 合成内置 EmbedView 作为渲染组件 */
export interface AppEmbedSpec {
  url: string
}

/**
 * entry 与 embed 二选一（决策 D2′）：类型层面互斥，编译期就挡住「两个都给」和「两个都不给」，
 * 运行时无需再判分支。窗口渲染路径因此始终只有一条，新增类目不改壳层。
 */
export type AppManifest = AppBase &
  ({ entry: EntryFn; embed?: never } | { embed: AppEmbedSpec; entry?: never })

interface AppBase {
  id: string
  name: string
  icon: IconName
  tint?: string
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

/** 交叉而非 interface extends：AppManifest 是联合类型，接口只能继承静态可知的单一对象类型 */
export type RegisteredApp = AppManifest & { component: Component }

const DEFAULT_ORDER = 100

function orderOf(app: { order?: number }): number {
  return app.order ?? DEFAULT_ORDER
}

export const useAppRegistry = defineStore('appRegistry', {
  state: () => ({
    apps: [] as RegisteredApp[],
  }),
  getters: {
    /** 当前会话可访问的应用（已按 order 排序）；派生入口一律消费此 getter，不各自过滤 */
    accessibleApps(state): RegisteredApp[] {
      const session = useSession()
      return state.apps.filter((a) => session.canAccessApp(a))
    },
    /** Dock 应用：可访问 + 用户固定项（settings 覆盖 manifest.dock 默认） */
    dockApps(): RegisteredApp[] {
      const settings = useSettings()
      return this.accessibleApps.filter((a) => settings.isPinned(a.id, a.dock !== false))
    },
    byId: (state) => (id: string) => state.apps.find((a) => a.id === id),
  },
  actions: {
    register(manifest: AppManifest) {
      if (this.apps.some((a) => a.id === manifest.id)) return
      // embed 类目没有自己的入口组件：合成内置 EmbedView，壳层因此不认识「iframe」这件事
      const load = manifest.embed ? () => import('@/windows/EmbedView.vue') : manifest.entry
      const app: RegisteredApp = {
        ...manifest,
        component: markRaw(defineAsyncComponent(load)),
      }
      // 按 order 升序插入（稳定：同权重保持先注册在前），使派生入口排序不依赖 import 顺序
      const at = this.apps.findIndex((a) => orderOf(a) > orderOf(app))
      if (at === -1) this.apps.push(app)
      else this.apps.splice(at, 0, app)
    },

    /** 运行时添加的应用可卸载：先由调用方关掉活窗口，再从注册表移除 */
    unregister(id: string) {
      const at = this.apps.findIndex((a) => a.id === id)
      if (at !== -1) this.apps.splice(at, 1)
    },
  },
})
