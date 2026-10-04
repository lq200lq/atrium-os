import { describe, expect, it } from 'vitest'
import { clamp, clampRect, desktopBounds, DOCK_ZONE_HEIGHT, TOP_BAR_HEIGHT } from '@/kernel/layout'

describe('clamp', () => {
  it('区间内原样返回', () => expect(clamp(5, 0, 10)).toBe(5))
  it('低于下界取下界', () => expect(clamp(-3, 0, 10)).toBe(0))
  it('高于上界取上界', () => expect(clamp(42, 0, 10)).toBe(10))
})

describe('desktopBounds', () => {
  it('扣除顶栏与 Dock 区', () => {
    const b = desktopBounds()
    expect(b.x).toBe(0)
    expect(b.y).toBe(TOP_BAR_HEIGHT)
    expect(b.w).toBe(window.innerWidth)
    expect(b.h).toBe(window.innerHeight - TOP_BAR_HEIGHT - DOCK_ZONE_HEIGHT)
  })
})

describe('clampRect', () => {
  it('尺寸不小于最小值且不超出桌面', () => {
    const r = clampRect({ x: -9999, y: -9999, w: 10, h: 10 }, 320, 200)
    const b = desktopBounds()
    expect(r.w).toBe(320)
    expect(r.h).toBe(200)
    expect(r.x).toBe(-320 + 120)
    expect(r.y).toBe(b.y)
  })

  it('拖拽视野保持：右下不越界过多', () => {
    const b = desktopBounds()
    const r = clampRect({ x: 99999, y: 99999, w: 400, h: 300 }, 320, 200)
    expect(r.x).toBe(b.w - 120)
    expect(r.y).toBe(b.y + b.h - 36)
  })
})
