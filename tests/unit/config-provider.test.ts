import { afterEach, describe, expect, it } from 'vitest'
import { h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { OsConfigProvider, OsEmpty, type Size } from '@/ui'
import { i18n, setLocale } from '@/i18n'

/**
 * OsConfigProvider 的模板顶部有一行注释，组件因此是 fragment 根：
 * VTU 的 wrapper.element 会落到挂载用的宿主 div 上，读不到作用域根自身的属性，
 * 所以这里统一 find('.os-config') 拿到真正的作用域根。
 */
const scopeRoot = (w: VueWrapper) => w.find('.os-config')

// 全局 locale 是跨文件共享状态：本文件切过英文，每条用例后都复位
afterEach(() => setLocale('zh-CN'))

describe('OsConfigProvider 作用域根', () => {
  it('渲染 os-config 根并把插槽内容原样交出去', () => {
    const w = mount(OsConfigProvider, { slots: { default: () => h('span', '子树') } })
    const root = scopeRoot(w)
    expect(root.exists()).toBe(true)
    expect(root.classes()).toEqual(['os-config', 'contents'])
    expect(w.text()).toBe('子树')
    // 未传 accent 时不落属性，子树继续跟随全局预设
    expect(root.element.hasAttribute('data-accent')).toBe(false)
  })

  it('accent 以预设键名落 data-accent，不在 JS 里算色值', () => {
    const w = mount(OsConfigProvider, { props: { accent: 'violet' } })
    expect(scopeRoot(w).attributes('data-accent')).toBe('violet')
  })

  it('controlHeight / radius 覆盖写成根上的 CSS 自定义属性，未传的档位不出现', () => {
    const w = mount(OsConfigProvider, {
      props: {
        controlHeight: { sm: '20px', lg: '36px' },
        radius: { chip: '2px', panel: '16px' },
      },
    })
    const style = scopeRoot(w).attributes('style') ?? ''
    expect(style).toContain('--control-height-sm: 20px')
    expect(style).toContain('--control-height-lg: 36px')
    expect(style).toContain('--radius-chip: 2px')
    expect(style).toContain('--radius-panel: 16px')
    expect(style).not.toContain('--control-height-md')
    expect(style).not.toContain('--radius-control')
  })

  it('非刻度键与空值被忽略，不产出无主变量', () => {
    // 越界键（不在 Size 三档 / 圆角四档之内）与空串值都不该写进 style
    const heights = { md: '1rem', xxl: '40px' } satisfies Record<string, string>
    const radii = { control: '5px', huge: '' } satisfies Record<string, string>
    const w = mount(OsConfigProvider, {
      props: {
        controlHeight: heights as Partial<Record<Size, string>>,
        radius: radii as Partial<Record<'chip' | 'control' | 'surface' | 'panel', string>>,
      },
    })
    const style = scopeRoot(w).attributes('style') ?? ''
    expect(style).toContain('--control-height-md: 1rem')
    expect(style).toContain('--radius-control: 5px')
    expect(style).not.toContain('--control-height-xxl')
    expect(style).not.toContain('--radius-huge')
  })

  it('不传任何覆盖时不落 style，也不改写全局 i18n locale', () => {
    const w = mount(OsConfigProvider, {
      props: { locale: 'en-US' },
      slots: { default: () => h(OsEmpty) },
    })
    expect(scopeRoot(w).attributes('style')).toBeUndefined()
    expect(i18n.global.locale.value).toBe('zh-CN')
  })
})

describe('OsConfigProvider 的 locale 作用域', () => {
  it('locale="en-US" 时子树内 OsEmpty 的内建文案出英文', () => {
    const w = mount(OsConfigProvider, {
      props: { locale: 'en-US' },
      slots: { default: () => h(OsEmpty) },
    })
    expect(w.text()).toContain('No data')
    expect(w.text()).not.toContain('暂无数据')
    expect(i18n.global.locale.value).toBe('zh-CN')
  })

  it('不传 locale 的 Provider 内仍跟随全局中文', () => {
    const w = mount(OsConfigProvider, {
      props: { size: 'sm', accent: 'rose' },
      slots: { default: () => h(OsEmpty) },
    })
    expect(w.text()).toContain('暂无数据')
  })

  it('全局切到英文后，Provider 仍能把子树单独覆盖回中文', () => {
    setLocale('en-US')
    expect(mount(OsEmpty).text()).toContain('No data')
    const w = mount(OsConfigProvider, {
      props: { locale: 'zh-CN' },
      slots: { default: () => h(OsEmpty) },
    })
    expect(w.text()).toContain('暂无数据')
  })
})
