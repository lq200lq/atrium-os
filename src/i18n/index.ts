import { createI18n, useI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import enUS from './locales/en-US'

export type Locale = 'zh-CN' | 'en-US'
export const LOCALES: Locale[] = ['zh-CN', 'en-US']

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: 'zh-CN' satisfies Locale,
  fallbackLocale: 'zh-CN',
  missingWarn: false,
  fallbackWarn: false,
  messages: { 'zh-CN': zhCN, 'en-US': enUS },
})

export function setLocale(locale: Locale) {
  i18n.global.locale.value = locale
}

/** 非组件上下文取词（store / manifest 名称本地化）。 */
export function translate(key: string, named?: Record<string, unknown>): string {
  return named ? i18n.global.t(key, named) : i18n.global.t(key)
}

interface Nameable {
  name: string
  nameKey?: string
}

/**
 * 组件内本地化应用名：manifest.nameKey 命中则随语言响应式变化，否则回退 manifest.name。
 * 依赖 setup 上下文调用（useI18n 需在组件 setup 内）。
 */
export function useAppName() {
  const { t } = useI18n()
  return (app?: Nameable | null): string => {
    if (!app) return ''
    return app.nameKey ? t(app.nameKey) : app.name
  }
}
