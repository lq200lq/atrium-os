import type { GapSize, SpaceAlign } from '../types'

/**
 * 间距/对齐 → 工具类的唯一映射（与 control.ts 同一思路）：
 * OsSpace / OsGrid 等布局件不再自写档位字符串，改一处即全库生效。
 */
export const GAP_CLASS: Record<GapSize, string> = {
  '2xs': 'gap-2xs',
  xs: 'gap-xs',
  sm: 'gap-sm',
  md: 'gap-md',
  lg: 'gap-lg',
  xl: 'gap-xl',
  '2xl': 'gap-2xl',
}

export const ALIGN_CLASS: Record<SpaceAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
}
