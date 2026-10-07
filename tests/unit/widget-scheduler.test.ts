import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activeChannels, setSuspended, subscribeTick } from '@/kernel/widget/scheduler'

/* T8：调度器全局唯一 + 可见性挂起。模块级单例跨用例存活，
 * 每个用例自己收口订阅（afterEach 统一退订），否则频道表带着上一个测试的尾巴。 */
let unsubs: (() => void)[] = []

function sub(ms: number, handler: () => void) {
  unsubs.push(subscribeTick(ms, handler))
}

beforeEach(() => {
  vi.useFakeTimers()
  unsubs = []
  setSuspended(false) // 复位挂起态，防上一条测试留下 running=false
})

afterEach(() => {
  unsubs.forEach((u: () => void) => u())
  unsubs = []
  setSuspended(false)
  vi.useRealTimers()
})

describe('subscribeTick 共享频道（解 E11）', () => {
  it('同一节奏的多个订阅者只挂一个活跃定时器', () => {
    const a = vi.fn()
    const b = vi.fn()
    const c = vi.fn()
    sub(60_000, a)
    sub(60_000, b)
    sub(60_000, c)

    expect(activeChannels()).toEqual([60_000]) // 「调度器全局唯一」的门禁断言
    expect(vi.getTimerCount()).toBe(1) // 三个订阅，一个 interval——不是三个

    vi.advanceTimersByTime(120_000)
    expect(a).toHaveBeenCalledTimes(2)
    expect(b).toHaveBeenCalledTimes(2)
    expect(c).toHaveBeenCalledTimes(2)
  })

  it('不同节奏各开各的频道', () => {
    const live = vi.fn()
    const hourly = vi.fn()
    sub(60_000, live)
    sub(3_600_000, hourly)
    expect(activeChannels().sort((x: number, y: number) => x - y)).toEqual([60_000, 3_600_000])

    vi.advanceTimersByTime(60_000)
    expect(live).toHaveBeenCalledTimes(1)
    expect(hourly).not.toHaveBeenCalled()
  })

  it('全部退订后频道连同定时器一起拆除', () => {
    const off1 = subscribeTick(60_000, vi.fn())
    const off2 = subscribeTick(60_000, vi.fn())
    expect(activeChannels()).toContain(60_000)

    off1()
    expect(activeChannels()).toContain(60_000) // 还有人在，不许提前拆
    off2()
    expect(activeChannels()).not.toContain(60_000)
    expect(vi.getTimerCount()).toBe(0)
    off2() // 重复退订要幂等
  })
})

describe('setSuspended 可见性挂起（小组件不在后台耗电）', () => {
  it('挂起停表、恢复补臂，期间到点不触发', () => {
    const tick = vi.fn()
    sub(60_000, tick)

    vi.advanceTimersByTime(60_000)
    expect(tick).toHaveBeenCalledTimes(1)

    setSuspended(true)
    expect(vi.getTimerCount()).toBe(0) // 定时器真的被 clearInterval，不是空转标记
    vi.advanceTimersByTime(5 * 60_000)
    expect(tick).toHaveBeenCalledTimes(1) // 挂起期间一个不漏进来……

    setSuspended(false)
    expect(vi.getTimerCount()).toBe(1) // ……回来后重新上弦
    vi.advanceTimersByTime(60_000)
    expect(tick).toHaveBeenCalledTimes(2)
  })

  it('挂起时新订阅只登记不 armed，恢复后才接进分发', () => {
    setSuspended(true)
    const late = vi.fn()
    sub(60_000, late)
    expect(activeChannels()).toContain(60_000) // 频道登记了
    expect(vi.getTimerCount()).toBe(0) // 但没开表

    setSuspended(false)
    vi.advanceTimersByTime(60_000)
    expect(late).toHaveBeenCalledTimes(1)
  })
})
