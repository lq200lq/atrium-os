import type { IconName } from '@/kernel/icons'
import type { NoticeLevel } from '@/kernel/stores/notification'

/**
 * 反馈分级 → 语义色 / 图标的唯一映射处（S10-C）。
 * `OsAlert`、`OsToast`、通知中心共用这张表，保证同一等级在各处颜色与图标一致；
 * 三级色全部取 S7 派生刻度（`-bg` / `-text` / `-border`），此处不调新色。
 * 类串为源码静态字面量——Tailwind 靠扫描生成，运行时拼接的类不存在。
 */
export const LEVEL_TINT: Record<NoticeLevel, string> = {
  info: 'border-info-border bg-info-bg text-info-text',
  success: 'border-success-border bg-success-bg text-success-text',
  warning: 'border-warning-border bg-warning-bg text-warning-text',
  error: 'border-danger-border bg-danger-bg text-danger-text',
}

/** 紧凑呈现（吐司图标、通知中心圆点）只取前景一档，不带底色 */
export const LEVEL_FG: Record<NoticeLevel, string> = {
  info: 'text-info-text',
  success: 'text-success-text',
  warning: 'text-warning-text',
  error: 'text-danger-text',
}

export const LEVEL_ICON: Record<NoticeLevel, IconName> = {
  info: 'info',
  success: 'check',
  warning: 'alert-triangle',
  error: 'x',
}

/**
 * 吐司/通知的缺省档：旧调用方不传 level 时行为不变（info 图标 + 被动 status 语义）。
 * error/warning 是「需要立刻知道」的等级，aria role 取 alert 打断路径播报。
 */
export const DEFAULT_LEVEL: NoticeLevel = 'info'

export const levelRole = (level: NoticeLevel): 'alert' | 'status' =>
  level === 'error' || level === 'warning' ? 'alert' : 'status'
