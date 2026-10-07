import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import {
  useWidgetRegistry,
  type WidgetConfigField,
  type WidgetManifest,
} from '@/kernel/stores/widgetRegistry'
import { sanitizeConfig, useWidgets, type WidgetConfigValues } from '@/kernel/stores/widgets'

/* mock IDB：updateConfig 的防抖落库不碰真库（沿用 widgets.test.ts 的口径） */
const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))
vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, structuredClone(value))
  }),
}))

/** 等一等 persist 的微服务（Promise 链），配合 fake timers 推进防抖窗口 */
async function flushed() {
  await Promise.resolve()
  await Promise.resolve()
}

/** 覆盖四类字段的 schema：文本 / 带 min-max-step 的数字 / select / 布尔 */
const schema: WidgetConfigField[] = [
  { key: 'city', type: 'text', default: '上海' },
  { key: 'offset', type: 'number', min: -12, max: 12, step: 1, default: 0 },
  { key: 'rows', type: 'number', min: 1, max: 10, step: 3, default: 1 },
  { key: 'format', type: 'select', options: [{ value: '12h' }, { value: '24h' }], default: '24h' },
  { key: 'showSeconds', type: 'boolean', default: true },
]

const manifest = (config?: WidgetConfigField[]): WidgetManifest => ({
  id: 'tz',
  name: 'tz',
  icon: 'sparkles',
  entry: () => Promise.resolve({} as Component),
  widget: { sizes: ['sm', 'md'] },
  config,
})

const clean = (raw: unknown, m: WidgetManifest = manifest(schema)) => sanitizeConfig(raw, m)

describe('sanitizeConfig：配置写入的 schema 边界（T12 运行时半）', () => {
  it('未声明键被静默丢弃——件/面板写什么都出不了 schema 画的圈', () => {
    const out = clean({ city: '东京', sneaky: true, __proto__hint: 'x' })
    expect(out).toEqual({ city: '东京', offset: 0, rows: 1, format: '24h', showSeconds: true })
    expect(out && 'sneaky' in out).toBe(false)
  })

  it('数字按 min/max 夹住；非数字回退 default', () => {
    expect(clean({ offset: 42 })?.offset).toBe(12)
    expect(clean({ offset: -40 })?.offset).toBe(-12)
    expect(clean({ offset: '7' })?.offset).toBe(7) // 可解析的字符串先落地再收敛
    expect(clean({ offset: 'abc' })?.offset).toBe(0) // NaN → 回退字段 default
  })

  it('step 吸附：明显越格的值取最近格点，合法值不被拽动', () => {
    expect(clean({ rows: 5 })?.rows).toBe(6) // 5 % 3 ≠ 0 → round(5/3)*3
    expect(clean({ rows: 6 })?.rows).toBe(6) // 已在 step 网格上，不动
    expect(clean({ rows: 2.5, offset: 4.5 })?.rows).toBe(3)
    // 吸附在夹取之后进行且夹取要复检：rows 99 → 先夹到 10，10 不在 step=3 网格上 → 吸附成 9
    expect(clean({ rows: 99 })?.rows).toBe(9)
  })

  it('select 只认候选值：越界回退 default，命中两侧空白可 trim 进来', () => {
    expect(clean({ format: '99h' })?.format).toBe('24h')
    expect(clean({ format: ' 12h ' })?.format).toBe('12h')
  })

  it('布尔只认真值与 "true" 字符串，其余一律 false', () => {
    expect(clean({ showSeconds: 'true' })?.showSeconds).toBe(true)
    expect(clean({ showSeconds: false })?.showSeconds).toBe(false)
    expect(clean({ showSeconds: 1 as never })?.showSeconds).toBe(false)
  })

  it('缺省全部取 schema default；字段没声明 default 且没给值则整键缺席', () => {
    expect(clean(undefined)).toEqual({
      city: '上海',
      offset: 0,
      rows: 1,
      format: '24h',
      showSeconds: true,
    })
    const partial = manifest([{ key: 'x', type: 'text' }, ...schema])
    expect(clean({}, partial)).toEqual({
      city: '上海',
      offset: 0,
      rows: 1,
      format: '24h',
      showSeconds: true,
    })
    expect('x' in (clean({}, partial) as WidgetConfigValues)).toBe(false)
  })

  it('无有效键返回 undefined 而不是空对象（不落脏快照）', () => {
    expect(clean({ sneaky: 1 }, manifest([]))).toBeUndefined()
    expect(clean({ sneaky: 1 }, manifest())).toBeUndefined()
  })
})

describe('updateConfig 的「越权写被丢」往返（T12 判据的 store 侧）', () => {
  beforeEach(() => {
    idbStore.clear()
    setActivePinia(createPinia())
    useWidgetRegistry().register(manifest(schema))
  })

  it('塞进未声明的 sneaky 键：store 与落库两份视图里都不该有它', async () => {
    // updateConfig 内部是 300ms 防抖落库，测试从一开始就把计时器接管住
    vi.useFakeTimers()
    try {
      const widgets = useWidgets()
      const res = widgets.add('tz')
      if (!res.ok) throw new Error('前置失败')

      widgets.updateConfig(res.instance.id, {
        city: '东京',
        offset: 42, // 越界，应被夹到 12
        format: '99h', // 不在候选里，应回退 '24h'
        sneaky: true, // schema 没有这个键，应被整键丢弃
      })

      expect(widgets.items[0].config).toEqual({
        city: '东京',
        offset: 12,
        rows: 1,
        format: '24h',
        showSeconds: true,
      })
      expect('sneaky' in (widgets.items[0].config as WidgetConfigValues)).toBe(false)

      // 防抖窗口过后落库的也是收敛后的那份（写边界：schema 之外无权威）
      await vi.advanceTimersByTimeAsync(300)
      await flushed()
      const saved = JSON.parse(JSON.stringify(widgets.items[0])) as {
        config: Record<string, unknown>
      }
      expect(idbStore.get('widgets-v1')).toEqual([saved])
      expect('sneaky' in saved.config).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('给未注册的实例或未知 kind 写配置：不炸也不产生任何写入', () => {
    const widgets = useWidgets()
    widgets.updateConfig('never-existed', { city: 'x' })
    expect(widgets.items).toEqual([])
  })
})
