import { defineAsyncComponent, markRaw, type Component } from 'vue'
import { defineStore } from 'pinia'
import type { IconName } from '../icons'

export interface AppWindowSpec {
  w: number
  h: number
  minW?: number
  minH?: number
}

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
}

export interface RegisteredApp extends AppManifest {
  component: Component
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
      this.apps.push({ ...manifest, component: markRaw(defineAsyncComponent(manifest.entry)) })
    },
  },
})
