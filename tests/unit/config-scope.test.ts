import { afterEach, describe, expect, it } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import { OsAvatar, OsButton, OsEmpty, OsInput, OsSpin } from '@/ui'
import OsConfigProvider from '@/ui/OsConfigProvider.vue'
import { CONTROL_HEIGHT, expectSizeContract } from './contract-helpers'
import { i18n, setLocale } from '@/i18n'

// 全局 locale 是共享状态：本文件内的 setLocale 必须复位，避免污染其它测试文件
afterEach(() => setLocale('zh-CN'))

describe('useControlSize：作用域缺省尺寸', () => {
  it('Provider size="sm" 时缺省按钮走 sm 档，显式 size="lg" 仍走 lg 档', () => {
    const w = mount(OsConfigProvider, {
      props: { size: 'sm' },
      slots: { default: () => [h(OsButton), h(OsButton, { size: 'lg' })] },
    })
    const buttons = w.findAll('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].classes()).toContain(CONTROL_HEIGHT.sm)
    expect(buttons[1].classes()).toContain(CONTROL_HEIGHT.lg)
  })

  it('无 Provider 时缺省档位保持 md（与 S11 之前一致）', () => {
    expectSizeContract(mount(OsButton).element, 'md')
    expectSizeContract(mount(OsAvatar).element, 'md')
    expectSizeContract(mount(OsSpin).element, 'md')
  })

  it('input 家族经 ControlShell 免费拿到作用域缺省', () => {
    const w = mount(OsConfigProvider, {
      props: { size: 'sm' },
      slots: { default: () => h(OsInput, { modelValue: '' }) },
    })
    const shell = w.element.firstElementChild
    expect(shell).not.toBeNull()
    expectSizeContract(shell as Element, 'sm')
  })
})

describe('useText：作用域内建文案 locale', () => {
  it('Provider locale="en-US" 时 OsEmpty 出英文，全局仍是 zh-CN', () => {
    const w = mount(OsConfigProvider, {
      props: { locale: 'en-US' },
      slots: { default: () => h(OsEmpty) },
    })
    expect(w.text()).toContain('No data')
    expect(i18n.global.locale.value).toBe('zh-CN')
  })

  it('Provider 外的 OsEmpty 仍显示中文', () => {
    expect(mount(OsEmpty).text()).toContain('暂无数据')
  })
})
