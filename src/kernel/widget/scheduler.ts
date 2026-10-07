import type { WidgetRefresh } from '../stores/widgetRegistry'

/**
 * 宿主级共享调度器：同一节奏只有**一个**定时器，多个实例订阅同一分发器（解 E11）。
 * 页面隐藏时整体挂起、回到前台补齐一次——小组件不该在后台耗电。
 */
type Handler = () => void

interface Channel {
  handlers: Set<Handler>
  timer: ReturnType<typeof setInterval> | null
}

const channels = new Map<number, Channel>()
/** 缺省随文档可见性起停（测试环境无 document 时视为可见） */
let running = typeof document === 'undefined' ? true : !document.hidden

function arm(ms: number, channel: Channel) {
  if (!running || channel.timer || channel.handlers.size === 0) return
  channel.timer = setInterval(() => {
    for (const handler of [...channel.handlers]) handler()
  }, ms)
}

function ensure(ms: number): Channel {
  const existing = channelFor(ms)
  if (existing) return existing
  const created: Channel = { handlers: new Set(), timer: null }
  channels.set(ms, created)
  return created
}

function channelFor(ms: number): Channel | undefined {
  return channels.get(ms)
}

/** 组件不直接用它——走 useWidgetTick，那里带自动退订与预览沙箱屏蔽 */
export function subscribeTick(ms: number, handler: Handler): () => void {
  const channel = ensure(ms)
  channel.handlers.add(handler)
  arm(ms, channel)
  return () => {
    channel.handlers.delete(handler)
    if (channel.handlers.size === 0 && channel.timer) {
      clearInterval(channel.timer)
      channel.timer = null
      channels.delete(ms)
    }
  }
}

export function setSuspended(suspended: boolean) {
  running = !suspended
  if (running) {
    for (const [ms, channel] of channels) arm(ms, channel)
  } else {
    for (const channel of channels.values()) {
      if (channel.timer) clearInterval(channel.timer)
      channel.timer = null
    }
  }
}

/** 调试/门禁用：当前活跃的节奏档数（首屏断言「调度器全局唯一」，T8） */
export function activeChannels(): number[] {
  return [...channels.keys()]
}

/** manifest.refresh → 取数节奏（毫秒）。day 给的是「检查间隔」，跨天才真的触发。 */
export const REFRESH_PERIOD: Record<WidgetRefresh, number | null> = {
  live: 60_000,
  minute: 5 * 60_000,
  hour: 60 * 60_000,
  day: 60_000,
  manual: null,
}

export function isDue(since: number, refresh: WidgetRefresh, now: number, dayChanged: boolean) {
  const period = REFRESH_PERIOD[refresh]
  if (period === null) return false
  if (refresh === 'day') return dayChanged
  return now - since >= period
}
