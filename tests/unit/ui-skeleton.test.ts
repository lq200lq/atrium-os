import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsSkeleton } from '@/ui'

describe('OsSkeleton', () => {
  it('text 变体按 rows 渲染占位条', () => {
    const w = mount(OsSkeleton, { props: { variant: 'text', rows: 4 } })
    expect(w.find('[aria-busy="true"]').exists()).toBe(true)
    expect(w.findAll('.animate-pulse > div')).toHaveLength(4)
  })

  it('rect / circle 变体各渲染单块占位', () => {
    for (const variant of ['rect', 'circle'] as const) {
      const w = mount(OsSkeleton, { props: { variant } })
      expect(w.findAll('div'), variant).toHaveLength(2)
    }
  })
})
