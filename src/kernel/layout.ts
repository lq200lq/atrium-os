export const TOP_BAR_HEIGHT = 44
export const DOCK_ZONE_HEIGHT = 88

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function desktopBounds(): Rect {
  return {
    x: 0,
    y: TOP_BAR_HEIGHT,
    w: window.innerWidth,
    h: window.innerHeight - TOP_BAR_HEIGHT - DOCK_ZONE_HEIGHT,
  }
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

export function clampRect(rect: Rect, minW: number, minH: number): Rect {
  const b = desktopBounds()
  const w = clamp(rect.w, minW, b.w)
  const h = clamp(rect.h, minH, b.h)
  const x = clamp(rect.x, -w + 120, b.w - 120)
  const y = clamp(rect.y, b.y, b.y + b.h - 36)
  return { x, y, w, h }
}
