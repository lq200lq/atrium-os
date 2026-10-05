import { inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { CONFIG_KEY } from '../config'
import { resolveMessage } from '@/i18n'

/**
 * 组件内建文案的取词入口（S11）：作用域内有 locale 覆盖时按该语言取词，
 * 否则回退全局 i18n（保持响应式）。业务应用仍直接用 vue-i18n 的 `t`。
 * `t` 在渲染期读取作用域值，切换 Provider 的 locale 会即时重渲染。
 */
export function useText() {
  const config = inject(CONFIG_KEY, null)
  const { t: globalT } = useI18n()

  function t(key: string, named?: Record<string, string | number>): string {
    const scoped = config?.value.locale
    if (scoped) return resolveMessage(scoped, key, named)
    return named ? globalT(key, named) : globalT(key)
  }

  return { t }
}
