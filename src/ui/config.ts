import { computed, inject, toValue, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import type { Size } from './types'
import type { Locale } from '@/i18n'

/**
 * 作用域配置契约（S11）：由 OsConfigProvider 提供、子树组件消费。
 * 与 theme store 的分工——store 管**全局持久化**设置，Provider 管**子树局部覆盖**：
 * Provider 的取值不写回 store，因此刷新不残留，也不越界影响其它窗口。
 */
export interface OsConfig {
  /** 子树内组件内建文案的语言；缺省跟随全局 i18n。 */
  locale?: Locale
  /** componentDefaults：子树内控件的缺省尺寸，组件自身的 size prop 仍可逐项覆盖。 */
  size?: Size
  /** 子树内的 seed 强调色（原色值，六级派生仍走 tokens.css 的唯一公式）。 */
  accent?: string
  /** 子树内覆盖控件高度刻度（key 与 Size 同域，值为 CSS 长度）。 */
  controlHeight?: Partial<Record<Size, string>>
  /** 子树内覆盖圆角刻度档位。 */
  radius?: Partial<Record<'chip' | 'control' | 'surface' | 'panel', string>>
}

/** 提供给子树的是响应式引用：Provider 的 props 变了，子树取到的值也变。 */
export const CONFIG_KEY: InjectionKey<Ref<OsConfig>> = Symbol('os-config')

/** 最近的配置作用域；不在任何 Provider 内时为 null，组件行为与 S11 之前完全一致。 */
export function useConfig(): Ref<OsConfig> | null {
  return inject(CONFIG_KEY, null)
}

/**
 * 控件尺寸的唯一决议点：显式 prop > 作用域 componentDefaults > 缺省 md。
 * 组件不再各自写 `props.size ?? 'md'`，加档位只改这一处。
 */
export function useControlSize(propSize?: () => Size | undefined): ComputedRef<Size> {
  const config = useConfig()
  return computed(() => toValue(propSize) ?? config?.value.size ?? 'md')
}
