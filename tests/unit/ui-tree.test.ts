import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsTree, type TreeNode } from '@/ui'
import { classTokens } from './contract-helpers'

const tree: TreeNode[] = [
  {
    key: 'a',
    label: 'A',
    children: [
      { key: 'a1', label: 'A-1' },
      { key: 'a2', label: 'A-2', children: [{ key: 'a21', label: 'A-2-1' }] },
    ],
  },
  { key: 'b', label: 'B', disabled: true },
  { key: 'c', label: 'C' },
]

describe('OsTree', () => {
  const rows = (w: ReturnType<typeof mount>) => w.findAll('[role="treeitem"]')

  it('渲染 tree 角色，默认只露出第一层并带 aria-level', () => {
    const w = mount(OsTree, { props: { data: tree } })
    expect(w.find('[role="tree"]').exists()).toBe(true)
    expect(rows(w)).toHaveLength(3)
    expect(rows(w)[0].attributes('aria-level')).toBe('1')
    expect(rows(w)[0].attributes('aria-expanded')).toBe('false')
  })

  it('展开切换 aria-expanded 并派发 update:expandedKeys', async () => {
    const w = mount(OsTree, { props: { data: tree } })
    await rows(w)[0].find('[data-tree-toggle]').trigger('click')
    expect(rows(w)).toHaveLength(5)
    expect(rows(w)[0].attributes('aria-expanded')).toBe('true')
    expect(w.emitted('update:expandedKeys')?.at(-1)).toEqual([['a']])
    await rows(w)[0].find('[data-tree-toggle]').trigger('click')
    expect(rows(w)).toHaveLength(3)
  })

  it('受控展开：外部 expandedKeys 决定可见行与层级', () => {
    const w = mount(OsTree, { props: { data: tree, expandedKeys: ['a', 'a2'] } })
    expect(rows(w)).toHaveLength(6)
    expect(rows(w)[3].attributes('aria-level')).toBe('3')
  })

  it('点击选择派发 select 与 selectedKeys，disabled 节点不响应', async () => {
    const w = mount(OsTree, { props: { data: tree } })
    await rows(w)[2].trigger('click')
    expect(w.emitted('select')?.[0]).toEqual([tree[2]])
    expect(w.emitted('update:selectedKeys')?.at(-1)).toEqual([['c']])
    expect(rows(w)[2].attributes('aria-selected')).toBe('true')
    await rows(w)[1].trigger('click')
    expect(w.emitted('select')).toHaveLength(1)
    expect(rows(w)[1].attributes('aria-disabled')).toBe('true')
    expect(classTokens(rows(w)[1].element)).toContain('is-disabled')
  })

  it('checkable：勾选叶子聚合父节点半选/全选，勾选父节点联动全部后代', async () => {
    const w = mount(OsTree, {
      props: { data: tree, checkable: true, expandedKeys: ['a', 'a2'] },
    })
    const boxes = () => w.findAll<HTMLInputElement>('input[type="checkbox"]')
    await boxes()[1].trigger('change')
    expect(w.emitted('update:checkedKeys')?.at(-1)?.[0]).toEqual(['a1'])
    expect(boxes()[0].element.indeterminate).toBe(true)
    await boxes()[3].trigger('change')
    expect(boxes()[2].element.checked).toBe(true)
    expect(boxes()[0].element.checked).toBe(true)
    expect(w.emitted('update:checkedKeys')?.at(-1)?.[0]).toEqual(['a1', 'a21'])
    await boxes()[0].trigger('change')
    expect(w.emitted('update:checkedKeys')?.at(-1)?.[0]).toEqual([])
  })

  it('懒加载：首次展开调用 loadData 并显示加载指示，再展开复用缓存', async () => {
    const loader = vi.fn(
      (node: TreeNode) =>
        new Promise<TreeNode[]>((resolve) => {
          setTimeout(() => resolve([{ key: `${node.key}-1`, label: '子项-1', isLeaf: true }]), 5)
        }),
    )
    const w = mount(OsTree, { props: { data: [{ key: 'L', label: 'L' }], loadData: loader } })
    await w.find('[data-tree-toggle]').trigger('click')
    expect(w.html()).toContain('animate-spin')
    await new Promise((r) => setTimeout(r, 20))
    await w.vm.$nextTick()
    expect(loader).toHaveBeenCalledTimes(1)
    expect(rows(w)).toHaveLength(2)
    await rows(w)[0].find('[data-tree-toggle]').trigger('click')
    await rows(w)[0].find('[data-tree-toggle]').trigger('click')
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('键盘导航：方向键移动焦点行、ArrowRight 展开、Enter 选择', async () => {
    const w = mount(OsTree, { props: { data: tree } })
    expect(rows(w)[0].attributes('tabindex')).toBe('0')
    expect(rows(w)[1].attributes('tabindex')).toBe('-1')
    await rows(w)[0].trigger('keydown', { key: 'ArrowDown' })
    expect(rows(w)[1].attributes('tabindex')).toBe('0')
    await rows(w)[0].trigger('keydown', { key: 'ArrowRight' })
    expect(rows(w)).toHaveLength(5)
    await rows(w)[4].trigger('keydown', { key: 'Enter' })
    expect(w.emitted('select')).toHaveLength(1)
    expect(w.emitted('update:selectedKeys')?.at(-1)).toEqual([['c']])
  })
})
