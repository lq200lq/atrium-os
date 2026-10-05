import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsEmpty } from '@/ui'

describe('OsEmpty', () => {
  it('渲染描述与操作插槽', () => {
    const w = mount(OsEmpty, {
      props: { description: '没有记录' },
      slots: { action: '<button class="act">新建</button>' },
    })
    expect(w.text()).toContain('没有记录')
    expect(w.find('button.act').exists()).toBe(true)
  })

  it('缺省描述取 i18n，图标可指定', () => {
    expect(mount(OsEmpty).text()).toContain('暂无数据')
    expect(
      mount(OsEmpty, { props: { icon: 'x' } })
        .find('svg')
        .exists(),
    ).toBe(true)
  })
})
