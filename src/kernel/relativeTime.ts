/**
 * 相对时间读数：件内两处（最近文件的 `updatedAt`、数据型件的「更新于」）共用一条口径。
 *
 * 走 `Intl.RelativeTimeFormat` 而不是语言包叶子：`numeric: 'auto'` 自带「刚刚 / 现在」这一档，
 * 单复数与单位缩写由各语言 CLDR 数据给（`{n} 分钟前` 这类手写叶子在英文里只能压成 `min`），
 * 语言包因此只保留包装语（`widgets.updated` 的「更新于 {time}」）。
 */
export function relativeTimeLabel(ts: number, now: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const diffSec = Math.round((ts - now) / 1000)
  const abs = Math.abs(diffSec)
  if (abs < 60) return rtf.format(diffSec, 'second')
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  return rtf.format(Math.round(diffSec / 86400), 'day')
}
