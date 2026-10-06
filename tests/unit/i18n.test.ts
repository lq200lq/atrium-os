import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { i18n, setLocale, translate } from '@/i18n'
import enUS from '@/i18n/locales/en-US'
import zhCN from '@/i18n/locales/zh-CN'
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

/** 递归收集叶子 key（值为字符串的节点） */
function leafKeys(tree: unknown, prefix = ''): string[] {
  if (!tree || typeof tree !== 'object') return prefix ? [prefix] : []
  return Object.entries(tree as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  )
}

// mergeLocaleMessage 会就地改写字典（下面的探测用例就是那么注入的），所以对照用的 key 集合在模块加载时定格。
const ZH_KEYS = leafKeys(zhCN)
const EN_KEYS = leafKeys(enUS)

describe('文案可被消息编译器接受', () => {
  // vue-i18n 的消息是运行期首次取词才编译的：`@` 开头会被当成 linked message 语法，
  // 写坏了整棵子树直接进错误边界，而逐件挂载的单测碰不到，所以这里全量 t() 一遍。
  for (const [locale, messages] of [
    ['zh-CN', zhCN],
    ['en-US', enUS],
  ] as const) {
    it(`${locale} 全部叶子消息可编译`, () => {
      setLocale(locale)
      const keys = leafKeys(messages)
      expect(keys.length).toBeGreaterThan(50)
      for (const key of keys) expect(() => i18n.global.t(key), key).not.toThrow()
    })
  }

  // 只测「各自能编译」碰不到缺键：en 少一条会静默回退成中文，界面变成中英混排却全绿。
  // 用模块加载时定格的 key：mergeLocaleMessage 会就地改写字典，上面的探测用例就是那么注入的。
  it('两份语言包叶子 key 集合完全一致', () => {
    expect(EN_KEYS.filter((k) => !ZH_KEYS.includes(k))).toEqual([])
    expect(ZH_KEYS.filter((k) => !EN_KEYS.includes(k))).toEqual([])
    expect(EN_KEYS).toHaveLength(ZH_KEYS.length)
  })
})

/** 收集某子树下的叶子 [key, 取值]，用于按「取值」找撞名 */
function leafEntries(tree: Record<string, unknown>, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([k, v]) =>
    v && typeof v === 'object'
      ? leafEntries(v as Record<string, unknown>, prefix ? `${prefix}.${k}` : k)
      : [[prefix ? `${prefix}.${k}` : k, String(v)] as [string, string]],
  )
}

// key 齐平管的是「有没有」，管不到「撞名」：docEditor 与 docsCenter 都写成 'Docs' 时两份语言包
// 依旧齐平、编译也不报错，但英文界面上是两个互不相干的应用共用一个名字，Dock 与窗口标题都分不出来。
describe('应用名在同一语言内不撞名', () => {
  for (const [locale, messages] of [
    ['zh-CN', zhCN],
    ['en-US', enUS],
  ] as const) {
    it(`${locale} 的 apps.* 取值互不相同`, () => {
      const entries = leafEntries(messages.apps as Record<string, unknown>, 'apps')
      const clash = entries.filter(([, v]) => entries.filter(([, o]) => o === v).length > 1)
      expect(clash.map(([k, v]) => `${k} = ${v}`).sort(), 'apps.* 出现重名应用').toEqual([])
    })
  }
})
