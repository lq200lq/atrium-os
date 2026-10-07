/**
 * 第二时区候选：值稳定（进 schema 与 IDB），可读名走语言包（`widgets.configOptions.tz.*`）。
 * 这里只保留「值 → IANA 时区」这一层事实，标签不在代码里（§4.11 i18n）。
 */
export const ZONE_VALUES = [
  'local',
  'shanghai',
  'tokyo',
  'seoul',
  'singapore',
  'bangkok',
  'jakarta',
  'dubai',
  'moscow',
  'london',
  'paris',
  'berlin',
  'cairo',
  'newyork',
  'chicago',
  'saopaulo',
  'losangeles',
  'sydney',
  'auckland',
] as const

export type ZoneValue = (typeof ZONE_VALUES)[number]

const IANA: Partial<Record<ZoneValue, string>> = {
  shanghai: 'Asia/Shanghai',
  tokyo: 'Asia/Tokyo',
  seoul: 'Asia/Seoul',
  singapore: 'Asia/Singapore',
  bangkok: 'Asia/Bangkok',
  jakarta: 'Asia/Jakarta',
  dubai: 'Asia/Dubai',
  moscow: 'Europe/Moscow',
  london: 'Europe/London',
  paris: 'Europe/Paris',
  berlin: 'Europe/Berlin',
  cairo: 'Africa/Cairo',
  newyork: 'America/New_York',
  chicago: 'America/Chicago',
  saopaulo: 'America/Sao_Paulo',
  losangeles: 'America/Los_Angeles',
  sydney: 'Australia/Sydney',
  auckland: 'Pacific/Auckland',
}

/** `local` 与未知值都给 undefined——调用方据此回落系统时区，不自己发明第三种状态 */
export function ianaOf(value: unknown): string | undefined {
  if (typeof value !== 'string' || value === 'local') return undefined
  return IANA[value as ZoneValue]
}

/** 该时区此刻是白天还是夜间（给 lg 的第二时区行配文字，颜色不当唯一语义通道，H-3） */
export function isDayIn(value: unknown, at: Date): boolean {
  const hourText = at.toLocaleTimeString('en-US', {
    hour: '2-digit',
    hour12: false,
    ...(ianaOf(value) ? { timeZone: ianaOf(value) } : {}),
  })
  const hour = Number.parseInt(hourText.slice(0, 2), 10)
  return Number.isFinite(hour) && hour >= 6 && hour < 18
}
