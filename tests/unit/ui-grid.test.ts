import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsGrid, type GridColumns } from '@/ui'

describe('OsGrid', () => {
  it('外层自带 cq-window，内层为 grid', () => {
    const w = mount(OsGrid, { slots: { default: '<i>1</i><i>2</i>' } })
    expect(w.classes()).toContain('cq-window')
    expect(w.find('.grid').exists()).toBe(true)
    expect(w.find('.grid').findAll('i')).toHaveLength(2)
  })

  it('默认 3 列 md 间隙，按窗口三档降列', () => {
    const grid = mount(OsGrid).find('.grid')
    expect(grid.classes()).toEqual(
      expect.arrayContaining(['grid-cols-1', 'w-mid:grid-cols-2', 'w-wide:grid-cols-3', 'gap-md']),
    )
  })

  it.each([1, 2, 3, 4, 5, 6] as GridColumns[])('columns=%s 时宽窗口为 %s 列', (columns) => {
    const grid = mount(OsGrid, { props: { columns } }).find('.grid')
    expect(grid.classes()).toContain(`w-wide:grid-cols-${columns}`)
  })

  it('窄窗口恒为最矮档（columns>2 不会在 narrow 下超过 2 列）', () => {
    const grid = mount(OsGrid, { props: { columns: 6 } }).find('.grid')
    expect(grid.classes()).toContain('grid-cols-2')
    expect(grid.classes()).toContain('w-mid:grid-cols-3')
  })

  it('gap 走间距刻度档', () => {
    expect(
      mount(OsGrid, { props: { gap: 'xs' } })
        .find('.grid')
        .classes(),
    ).toContain('gap-xs')
  })
})
