<script setup lang="ts">
import { computed, provide } from 'vue'
import { CONFIG_KEY, type OsConfig } from './config'
import type { Locale } from '@/i18n'
import type { Size } from './types'

/**
 * 作用域配置入口（S11）：locale / componentDefaults(size) / theme（accent、控件高度、圆角）。
 * 只做两件事——把配置 provide 给子树组件，并把可覆盖的刻度写成 CSS 变量；
 * 颜色公式不在此生成，仍只在 tokens.css 的派生块写一次（.os-config 就近重算别名）。
 * 不写 store、不持久化：全局设置归 theme store，这里是子树级覆盖。
 */
const props = defineProps<{
  /** 子树内组件内建文案的语言。 */
  locale?: Locale
  /** 子树内控件的缺省尺寸。 */
  size?: Size
  /** 子树内的强调色预设（sky/violet/emerald/rose，与全局设置为同一批预设）。 */
  accent?: string
  /** 子树内的控件高度刻度覆盖。 */
  controlHeight?: Partial<Record<Size, string>>
  /** 子树内的圆角刻度覆盖。 */
  radius?: Partial<Record<'chip' | 'control' | 'surface' | 'panel', string>>
}>()

const config = computed<OsConfig>(() => ({
  locale: props.locale,
  size: props.size,
  accent: props.accent,
  controlHeight: props.controlHeight,
  radius: props.radius,
}))

provide(CONFIG_KEY, config)

const CSS_VARS: Record<Size, string> = {
  sm: '--control-height-sm',
  md: '--control-height-md',
  lg: '--control-height-lg',
}
const RADIUS_VARS: Record<'chip' | 'control' | 'surface' | 'panel', string> = {
  chip: '--radius-chip',
  control: '--radius-control',
  surface: '--radius-surface',
  panel: '--radius-panel',
}

const cssVars = computed(() => {
  const vars: Record<string, string> = {}
  for (const [size, value] of Object.entries(props.controlHeight ?? {})) {
    const name = CSS_VARS[size as Size]
    if (name && value) vars[name] = value
  }
  for (const [tier, value] of Object.entries(props.radius ?? {})) {
    const name = RADIUS_VARS[tier as keyof typeof RADIUS_VARS]
    if (name && value) vars[name] = value
  }
  return vars
})
</script>

<template>
  <!-- contents 让包装层不参与布局：作用域只负责传变量与 inject，不改变子树排版 -->
  <div class="os-config contents" :data-accent="accent" :style="cssVars">
    <slot />
  </div>
</template>
