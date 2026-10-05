import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsMenu, type MenuItem } from '@/ui'
import { classTokens } from './contract-helpers'

const items: MenuItem[] = [
  {
    key: 'file',
    label: '文件',
    icon: 'folder',
    children: [
      { key: 'new-dir', label: '新建目录' },
      { key: 'new-doc', label: '新建文档', icon: 'file-text' },
    ],
  },
  { key: 'edit', label: '编辑' },
  { key: 'del', label: '删除', danger: true },
  { key: 'share', label: '共享', disabled: true },
]

describe('OsMenu 渲染与选择契约', () => {
  it('role=menu + menuitem，icon 渲染 svg，disabled 走 is-disabled 与 aria-disabled', () => {
    const w = mount(OsMenu, { props: { items } })
    expect(w.find('[role="menu"]').exists()).toBe(true)
    const rows = () => w.findAll('[role="menuitem"]')
    expect(rows()).toHaveLength(4)
    expect(rows()[0].find('svg').exists()).toBe(true)
    expect(rows()[3].attributes('aria-disabled')).toBe('true')
    expect(classTokens(rows()[3].element)).toContain('is-disabled')
  })

  it('点击叶子派发 click(key) 并写回 selectedKeys；选中态取 accent 刻度', async () => {
    const w = mount(OsMenu, { props: { items } })
    await w.findAll('[role="menuitem"]')[1].trigger('click')
    expect(w.emitted('click')?.[0]).toEqual(['edit'])
    expect(w.emitted('update:selectedKeys')?.at(-1)).toEqual([['edit']])
    expect(classTokens(w.findAll('[role="menuitem"]')[1].element)).toContain('bg-accent-bg')
    expect(classTokens(w.findAll('[role="menuitem"]')[1].element)).toContain('text-accent-text')
  })

  it('disabled 项不响应点击；danger 项取 danger 文本刻度', async () => {
    const w = mount(OsMenu, { props: { items } })
    const rows = () => w.findAll('[role="menuitem"]')
    await rows()[3].trigger('click')
    expect(w.emitted('click')).toBeUndefined()
    expect(classTokens(rows()[2].element)).toContain('text-danger-text')
  })

  it('受控 selectedKeys：外部传入的 key 高亮', () => {
    const w = mount(OsMenu, { props: { items, selectedKeys: ['del'] } })
    expect(classTokens(w.findAll('[role="menuitem"]')[2].element)).toContain('bg-danger-bg')
  })

  it('二级子菜单：父项 aria-haspopup/expanded，点击展开子级、再点收起', async () => {
    const w = mount(OsMenu, { props: { items } })
    const parent = w.findAll('[role="menuitem"]')[0]
    expect(parent.attributes('aria-haspopup')).toBe('true')
    expect(parent.attributes('aria-expanded')).toBe('false')
    await parent.trigger('click')
    expect(w.findAll('[role="menuitem"]')).toHaveLength(6)
    expect(w.findAll('[role="menuitem"]')[0].attributes('aria-expanded')).toBe('true')
    await w.findAll('[role="menuitem"]')[0].trigger('click')
    expect(w.findAll('[role="menuitem"]')).toHaveLength(4)
  })
})

describe('OsMenu 键盘导航（纵向）', () => {
  const rowsOf = (w: ReturnType<typeof mount>) => w.findAll('[role="menuitem"]')

  it('roving tabindex：整组只占一个 tab 停靠点，ArrowDown/Up 移动焦点行', async () => {
    const w = mount(OsMenu, { props: { items } })
    expect(rowsOf(w)[0].attributes('tabindex')).toBe('0')
    expect(rowsOf(w)[1].attributes('tabindex')).toBe('-1')
    await rowsOf(w)[0].trigger('keydown', { key: 'ArrowDown' })
    expect(rowsOf(w)[1].attributes('tabindex')).toBe('0')
    await rowsOf(w)[1].trigger('keydown', { key: 'ArrowUp' })
    expect(rowsOf(w)[0].attributes('tabindex')).toBe('0')
  })

  it('ArrowRight 展开子菜单，ArrowLeft 收回', async () => {
    const w = mount(OsMenu, { props: { items } })
    await rowsOf(w)[0].trigger('keydown', { key: 'ArrowRight' })
    expect(rowsOf(w)).toHaveLength(6)
    await rowsOf(w)[0].trigger('keydown', { key: 'ArrowLeft' })
    expect(rowsOf(w)).toHaveLength(4)
  })

  it('Enter/Space 选中焦点叶子并派发 click', async () => {
    const w = mount(OsMenu, { props: { items } })
    await rowsOf(w)[1].trigger('keydown', { key: 'Enter' })
    expect(w.emitted('click')?.[0]).toEqual(['edit'])
    await rowsOf(w)[2].trigger('keydown', { key: ' ' })
    expect(w.emitted('click')?.at(-1)).toEqual(['del'])
  })

  it('focusFirst 暴露给浮层宿主：焦点落进首个 menuitem', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const w = mount(OsMenu, { props: { items }, attachTo: host })
    w.vm.focusFirst()
    await w.vm.$nextTick()
    expect(document.activeElement).toBe(rowsOf(w)[0].element)
    w.unmount()
    host.remove()
  })
})

describe('OsMenu 键盘导航（横向）', () => {
  const top = (w: ReturnType<typeof mount>) =>
    w.findAll('[role="menu"]').at(-1)!.findAll('[role="menuitem"]')

  it('左右键在顶层组间移动焦点', async () => {
    const w = mount(OsMenu, { props: { items, mode: 'horizontal' } })
    expect(top(w)[0].attributes('tabindex')).toBe('0')
    await top(w)[0].trigger('keydown', { key: 'ArrowRight' })
    expect(top(w)[1].attributes('tabindex')).toBe('0')
    await top(w)[1].trigger('keydown', { key: 'ArrowLeft' })
    expect(top(w)[0].attributes('tabindex')).toBe('0')
  })

  it('ArrowDown 展开子菜单浮层并进入首项；Enter 选中子级并收组', async () => {
    const w = mount(OsMenu, { props: { items, mode: 'horizontal' } })
    await top(w)[0].trigger('keydown', { key: 'ArrowDown' })
    expect(w.findAll('[role="menuitem"]')).toHaveLength(6)
    // 横向模式的子级浮层内联在其父项之后：file → new-dir → new-doc → edit → …
    const child = w.findAll('[role="menuitem"]')[1]
    expect(child.text()).toBe('新建目录')
    expect(child.attributes('tabindex')).toBe('0')
    await child.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('click')?.[0]).toEqual(['new-dir'])
    expect(w.findAll('[role="menuitem"]')).toHaveLength(4)
  })

  it('Escape 关闭浮层并把焦点还给父项', async () => {
    const w = mount(OsMenu, { props: { items, mode: 'horizontal' } })
    await top(w)[0].trigger('keydown', { key: 'ArrowDown' })
    const child = w.findAll('[role="menuitem"]')[1]
    await child.trigger('keydown', { key: 'Escape' })
    expect(w.findAll('[role="menuitem"]')).toHaveLength(4)
    expect(top(w)[0].attributes('tabindex')).toBe('0')
  })

  it('浮层取 z-panel 刻度且条目渲染 danger/disabled 语义', async () => {
    const w = mount(OsMenu, {
      props: {
        mode: 'horizontal',
        items: [
          { key: 'p', label: 'P', children: [{ key: 'd', label: 'D', danger: true }] },
          { key: 'q', label: 'Q' },
        ],
      },
    })
    await top(w)[0].trigger('click')
    const panel = w.find('.z-panel')
    expect(panel.exists()).toBe(true)
    expect(classTokens(w.findAll('[role="menuitem"]')[1].element)).toContain('text-danger-text')
  })
})
