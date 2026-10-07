import { markRaw } from 'vue'
import { defineStore } from 'pinia'
import { useNotification } from './notification'

/**
 * 壳层右键菜单条目：`label` 由调用方本地化（各自 `t()` 得出），`run` 闭包捕获自己的上下文。
 * 条目里带函数，因此整份状态 markRaw（不做响应式代理；菜单整体换对象，也不需要逐项追踪）。
 */
export interface ContextMenuItem {
  key: string
  label: string
  /** 当前项态（尺寸档用）：左侧出一个勾 */
  checked?: boolean
  /** 危险语义：文字取 danger 刻度 */
  danger?: boolean
  /** 与前一组隔开：本项之前画一条分隔线 */
  separatorBefore?: boolean
  run: () => void
}

export interface ContextMenuState {
  x: number
  y: number
  items: ContextMenuItem[]
}

export const useShellUi = defineStore('shellUi', {
  state: () => ({
    notificationsOpen: false,
    spotlightOpen: false,
    widgetGalleryOpen: false,
    /** 抽屉打开后要定位并高亮的实例（卡片菜单「配置…」用，§4.5 第 1 项） */
    focusInstanceId: null as string | null,
    /** 卡片菜单「配置…」的宿主弹层（§4.12）：面板本体与管理面共用，弹层归这里 */
    configInstanceId: null as string | null,
    /** 「显示桌面」速览：窗口层整体淡出，再点还原（解 E10，与 Dock 层叠动作同族） */
    desktopRevealed: false,
    /**
     * 单例右键菜单通道：桌面空白处与小组件卡片都推条目进来，同一时刻只呈现最后一个。
     * 宿主组件（`shell/ContextMenu.vue`）挂在 App 根级——小组件层自身是 z-desktop 的层叠
     * 上下文，弹层挂在层内会被窗口盖住。
     */
    contextMenu: null as ContextMenuState | null,
  }),
  actions: {
    /**
     * 只开不关、且**不清未读**：小组件「通知摘要」的下钻落点是「回到还没处理的通知」，
     * 打开面板顺手 markAllRead 会让未读数在用户看清之前就消失（§4.5 下钻语义）。
     */
    openNotifications() {
      this.notificationsOpen = true
      this.spotlightOpen = false
      this.widgetGalleryOpen = false
      this.closeContextMenu()
    },
    toggleNotifications() {
      if (this.notificationsOpen) {
        this.notificationsOpen = false
        return
      }
      this.openNotifications()
      useNotification().markAllRead()
    },
    openSpotlight() {
      this.spotlightOpen = true
      this.notificationsOpen = false
      this.widgetGalleryOpen = false
      this.closeContextMenu()
    },
    openWidgetGallery(instanceId?: string | null) {
      this.widgetGalleryOpen = true
      this.focusInstance(instanceId ?? null)
      this.notificationsOpen = false
      this.spotlightOpen = false
      this.closeContextMenu()
    },
    /** §4.5 的「滚动 + 高亮到该实例」：管理面两处宿主（抽屉与中心窗口）都读这一个字段 */
    focusInstance(instanceId: string | null) {
      this.focusInstanceId = instanceId
    },
    closeWidgetGallery() {
      this.widgetGalleryOpen = false
      this.focusInstanceId = null
    },
    /** 卡片菜单「配置…」：弹层容器归宿主（§4.12），面板本体与管理面是同一份实现 */
    openWidgetConfig(instanceId: string) {
      this.configInstanceId = instanceId
      this.closeContextMenu()
    },
    closeWidgetConfig() {
      this.configInstanceId = null
    },
    /** 顶栏「显示桌面」与快捷键共用一个开关；再点一次还原窗口层 */
    toggleDesktopReveal() {
      this.desktopRevealed = !this.desktopRevealed
    },
    setDesktopRevealed(revealed: boolean) {
      this.desktopRevealed = revealed
    },
    openContextMenu(x: number, y: number, items: ContextMenuItem[]) {
      this.contextMenu = markRaw({ x, y, items })
    },
    closeContextMenu() {
      this.contextMenu = null
    },
    closeOverlays() {
      this.notificationsOpen = false
      this.spotlightOpen = false
      this.widgetGalleryOpen = false
      this.configInstanceId = null
      this.closeContextMenu()
    },
  },
})
