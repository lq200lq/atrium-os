import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsSpace } from '@/ui'

describe('OsSpace', () => {
  it('默认横向排列、sm 间隙、顶部对齐', () => {
    const w = mount(OsSpace, { slots: { default: '<b>1</b><b>2</b>' } })
    expect(w.classes()).toEqual(
      expect.arrayContaining(['flex', 'flex-row', 'gap-sm', 'items-start']),
    )
    expect(w.findAll('b')).toHaveLength(2)
  })

  it('direction / size / align / wrap 映射为刻度类', () => {
    const w = mount(OsSpace, {
      props: { direction: 'column', size: '2xl', align: 'center', wrap: true },
    })
    expect(w.classes()).toEqual(
      expect.arrayContaining(['flex-col', 'gap-2xl', 'items-center', 'flex-wrap']),
    )
  })

  it.each(['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const)('size=%s 取对应间隙档', (size) => {
    expect(mount(OsSpace, { props: { size } }).classes()).toContain(`gap-${size}`)
  })

  it.each(['start', 'center', 'end', 'stretch', 'baseline'] as const)(
    'align=%s 取 items-%s',
    (align) => {
      expect(mount(OsSpace, { props: { align } }).classes()).toContain(`items-${align}`)
    },
  )
})
