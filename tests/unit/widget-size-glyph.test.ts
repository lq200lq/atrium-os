import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WidgetSizeGlyph from '@/components/WidgetSizeGlyph.vue'
import { SIZE_SPAN } from '@/kernel/widget/geometry'
import type { WidgetSize } from '@/kernel/stores/widgetRegistry'

describe('WidgetSizeGlyph 网格尺寸字形', () => {
  it('4×4 点阵按 SIZE_SPAN 点亮跨幅：形状从几何常量派生，不写死', () => {
    for (const size of ['sm', 'md', 'lg'] as WidgetSize[]) {
      const wrapper = mount(WidgetSizeGlyph, { props: { size } })
      const cells = wrapper.element.querySelectorAll('[data-size-glyph-cell]')
      expect(cells.length, `${size} 底阵 16 格`).toBe(16)
      const lit = wrapper.element.querySelectorAll('[data-size-glyph-cell][data-lit="true"]')
      expect(lit.length, `${size} 点亮块 = w×h`).toBe(SIZE_SPAN[size].w * SIZE_SPAN[size].h)
    }
  })

  it('纯形状：无文本节点；缺省 aria-hidden 不进读屏，给了 ariaLabel 才作为 img', () => {
    const plain = mount(WidgetSizeGlyph, { props: { size: 'sm' } })
    expect(plain.text()).toBe('')
    expect(plain.attributes('aria-hidden')).toBe('true')
    expect(plain.attributes('role')).toBeUndefined()

    const labeled = mount(WidgetSizeGlyph, { props: { size: 'md', ariaLabel: '中' } })
    expect(labeled.attributes('role')).toBe('img')
    expect(labeled.attributes('aria-label')).toBe('中')
    expect(labeled.attributes('aria-hidden')).toBeUndefined()
  })
})
