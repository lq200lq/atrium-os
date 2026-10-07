import { defineStore } from 'pinia'
import type { Rect } from '../layout'
import type { OverflowReason } from '../widget/geometry'

/**
 * 小组件运行态：摆放结果、上次取数时间、手动刷新信号。
 * **刻意不落库**——这些都是本次会话的显示层事实，落库的只有实例与 kind 生命周期（widgets.ts）。
 */
export interface PlacementState {
  visible: boolean
  overflow: OverflowReason | null
  /** 用户摆的那一格（L-9：排序动作对它置灰） */
  manual: boolean
}

export const useWidgetRuntime = defineStore('widgetRuntime', {
  state: () => ({
    placement: {} as Record<string, PlacementState>,
    /** 桌面当前占用的 band 数（E18 的唯一权威：由 WidgetLayer 的摆放结果给出，标语据此让位） */
    bandsUsed: 0,
    /**
     * 已上桌面那些件的**外接矩形**（视口像素，同源来自摆放结果）。
     * 窄窗口下只剩一个 band 时，件仍会横向压进左侧标语区，band 数看不出来——给标语
     * 一条能算相交的依据（E18 的补条，见功能设计 §8 偏差 24）。
     */
    usedRect: null as Rect | null,
    lastRefreshAt: {} as Record<string, number>,
    /** 「立即刷新」计数：件用 watch 消费，涨一次取一次数 */
    refreshSignal: {} as Record<string, number>,
  }),
  getters: {
    placementOf:
      (state) =>
      (id: string): PlacementState =>
        state.placement[id] ?? { visible: true, overflow: null, manual: false },
    refreshCount: (state) => (id: string) => state.refreshSignal[id] ?? 0,
    /** 溢出清单（§4.7 第 3 步）：给「是哪些 + 为什么」，不再是黑箱数字 */
    overflowEntries(state): { id: string; reason: OverflowReason }[] {
      return Object.entries(state.placement)
        .filter(([, p]) => p.overflow)
        .map(([id, p]) => ({ id, reason: p.overflow as OverflowReason }))
        .sort((a, b) => a.id.localeCompare(b.id))
    },
  },
  actions: {
    /** 由宿主层（WidgetLayer）每帧写入；传空表示「都可见」。bandsUsed/usedRect 与摆放结果同源，避免两处各算一遍 */
    syncPlacement(
      entries: Record<string, PlacementState>,
      bandsUsed: number,
      usedRect: Rect | null = null,
    ) {
      this.placement = entries
      this.bandsUsed = bandsUsed
      this.usedRect = usedRect
    },
    markRefreshed(id: string) {
      this.lastRefreshAt[id] = Date.now()
    },
    requestRefresh(id: string) {
      this.refreshSignal[id] = (this.refreshSignal[id] ?? 0) + 1
      this.markRefreshed(id)
    },
    forget(id: string) {
      delete this.placement[id]
      delete this.lastRefreshAt[id]
      delete this.refreshSignal[id]
    },
  },
})
