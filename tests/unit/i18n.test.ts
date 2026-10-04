import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { i18n, setLocale, translate } from '@/i18n'
import { useSettings } from '@/kernel/stores/settings'

const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))

vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value)
  }),
}))

describe('i18n 语言与回退', () => {
  beforeEach(() => setLocale('zh-CN'))

  it('默认中文取词', () => {
    expect(translate('brand.slogan')).toBe('万物皆应用')
  })

  it('切换英文后取英文', () => {
    setLocale('en-US')
    expect(translate('brand.slogan')).toBe('Everything is an app')
    expect(translate('common.confirm')).toBe('Confirm')
  })

  it('未翻译项回退中文而非显示 key', () => {
    i18n.global.mergeLocaleMessage('zh-CN', { probe: { onlyZh: '仅中文' } })
    setLocale('en-US')
    expect(translate('probe.onlyZh')).toBe('仅中文')
  })

  it('插值消息按参数展开', () => {
    setLocale('zh-CN')
    expect(translate('pagination.total', { n: 20 })).toBe('共 20 条')
  })
})

describe('settings 语言偏好', () => {
  beforeEach(() => {
    idbStore.clear()
    setActivePinia(createPinia())
    setLocale('zh-CN')
  })

  it('setLang 同步 i18n 全局 locale 并持久化', async () => {
    const settings = useSettings()
    settings.setLang('en-US')
    expect(i18n.global.locale.value).toBe('en-US')
    await settings.persist()
    expect(idbStore.get('settings-v1')).toMatchObject({ lang: 'en-US' })
  })

  it('restore 还原语言并同步 i18n', async () => {
    idbStore.set('settings-v1', { dockPinned: {}, lang: 'en-US' })
    const settings = useSettings()
    await settings.restore()
    expect(settings.lang).toBe('en-US')
    expect(i18n.global.locale.value).toBe('en-US')
  })

  it('非法语言被忽略', () => {
    const settings = useSettings()
    // @ts-expect-error 验证运行期守卫
    settings.setLang('fr-FR')
    expect(settings.lang).toBe('zh-CN')
  })
})
