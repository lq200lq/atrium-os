import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTheme } from '@/kernel/stores/theme'

const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))

vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value)
  }),
}))

const root = () => document.documentElement

describe('theme 主题纵深', () => {
  beforeEach(() => {
    idbStore.clear()
    setActivePinia(createPinia())
    root().removeAttribute('data-theme')
    root().removeAttribute('data-accent')
  })

  it('setMode / setAccent 落到根 data-* 并可回退', () => {
    const theme = useTheme()
    theme.setMode('dark')
    expect(root().dataset.theme).toBe('dark')
    theme.setAccent('violet')
    expect(root().dataset.accent).toBe('violet')
    theme.toggleMode()
    expect(theme.mode).toBe('light')
    expect(root().dataset.theme).toBe('light')
  })

  it('restore 应用已持久化的 mode/accent 到 DOM', async () => {
    const theme = useTheme()
    theme.setMode('dark')
    theme.setAccent('emerald')
    await theme.persist()

    setActivePinia(createPinia())
    const fresh = useTheme()
    await fresh.restore()
    expect(fresh.mode).toBe('dark')
    expect(fresh.accent).toBe('emerald')
    expect(root().dataset.theme).toBe('dark')
    expect(root().dataset.accent).toBe('emerald')
  })

  it('迁移：旧数据（无 version/mode/accent）只读壁纸，其余取缺省', async () => {
    idbStore.set('theme-v1', { wallpaper: 'wallpaper-dusk' })
    const theme = useTheme()
    await theme.restore()
    expect(theme.wallpaper).toBe('wallpaper-dusk')
    expect(theme.mode).toBe('light')
    expect(theme.accent).toBe('sky')
    expect(root().dataset.theme).toBe('light')
  })

  it('cycleWallpaper 循环到下一个壁纸', () => {
    const theme = useTheme()
    const start = theme.wallpaper
    theme.cycleWallpaper()
    expect(theme.wallpaper).not.toBe(start)
  })
})
