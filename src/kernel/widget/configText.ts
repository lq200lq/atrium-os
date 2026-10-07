import type { NormalizedOption, WidgetConfigField } from '../stores/widgetRegistry'

type Translate = (key: string) => string
type HasKey = (key: string) => boolean

/**
 * 配置面文案解析（E6）：`labelKey` 优先、`label` 兜底。
 * 兜底不是可选装饰——IDB 与 manifest 可被手改，键缺失时界面该显示原值而不是空白。
 */
export function fieldLabel(field: WidgetConfigField, t: Translate, te: HasKey): string {
  if (field.labelKey && te(field.labelKey)) return t(field.labelKey)
  return field.label ?? field.key
}

export function optionLabel(option: NormalizedOption, t: Translate, te: HasKey): string {
  if (option.labelKey && te(option.labelKey)) return t(option.labelKey)
  return option.label ?? option.value
}
