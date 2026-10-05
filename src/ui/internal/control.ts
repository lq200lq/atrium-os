import type { Size, Status } from '../types'

/**
 * 刻度 → 工具类的唯一映射（S8 契约一致性来源）：
 * Button/Input/Select/Checkbox/Radio/Switch 的 size 与 status 都从这里取，
 * 各组件不再自写档位字符串，改一处即全库生效。
 */
const HEIGHT: Record<Size, string> = {
  sm: 'h-control-sm',
  md: 'h-control',
  lg: 'h-control-lg',
}

const PADDING: Record<Size, string> = {
  sm: 'px-xs',
  md: 'px-sm',
  lg: 'px-md',
}

/** 非 default 状态的描边 + 状态环：深浅一律取语义色的 -text / -border 两级 */
const STATUS_OUTLINE: Record<'error' | 'warning', string> = {
  error: 'border-danger-text ring-1 ring-danger-border',
  warning: 'border-warning-text ring-1 ring-warning-border',
}

const NEUTRAL_OUTLINE = 'border-line focus-within:border-accent'

export const controlHeightClass = (size: Size): string => HEIGHT[size]

export const controlPaddingClass = (size: Size): string => PADDING[size]

/** bordered=false 用于本来无描边的控件（Switch），default 态不加边框 */
export const controlStatusClass = (status: Status, bordered = true): string =>
  status === 'default' ? (bordered ? NEUTRAL_OUTLINE : '') : STATUS_OUTLINE[status]
