import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OsPagination from '@/ui/OsPagination.vue'
import OsTable from '@/ui/OsTable.vue'

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const columns = [
  { key: 'name' as const, title: '姓名', sortable: true },
  { key: 'age' as const, title: '年龄', sortable: true, align: 'right' as const },
]

const rows: Row[] = [
  { id: 1, name: '张三', age: 28 },
  { id: 2, name: '李四', age: 34 },
  { id: 3, name: '王五', age: 22 },
]

const manyRows: Row[] = [
  { id: 1, name: 'A', age: 30 },
  { id: 2, name: 'B', age: 20 },
  { id: 3, name: 'C', age: 40 },
  { id: 4, name: 'D', age: 10 },
  { id: 5, name: 'E', age: 50 },
]

describe('OsTable', () => {
  it('渲染表头与数据行', () => {
    const w = mount(OsTable, { props: { columns, rows } })
    expect(w.findAll('thead th').map((th) => th.text())).toContain('姓名')
    expect(w.findAll('tbody tr')).toHaveLength(3)
    expect(w.text()).toContain('张三')
  })

  it('点击可排序列在本地按升/降序重排', async () => {
    const w = mount(OsTable, { props: { columns, rows } })
    const ageHeader = w.findAll('thead th')[1]
    await ageHeader.trigger('click') // asc
    expect(w.findAll('tbody tr')[0].text()).toContain('22')
    await ageHeader.trigger('click') // desc
    expect(w.findAll('tbody tr')[0].text()).toContain('34')
    expect(w.emitted('sort-change')).toBeTruthy()
  })

  it('remote 模式不本地排序，仅派发事件', async () => {
    const w = mount(OsTable, { props: { columns, rows, remote: true } })
    await w.findAll('thead th')[1].trigger('click')
    expect(w.findAll('tbody tr')[0].text()).toContain('28') // 原顺序
    expect(w.emitted('sort-change')?.[0]).toEqual([{ key: 'age', order: 'asc' }])
  })

  it('本地模式给了 total 就按页截取表体行，页码变了行也变', async () => {
    const w = mount(OsTable, {
      props: { columns, rows: manyRows, total: 5, pageSize: 2, page: 1 },
    })
    expect(w.findAll('tbody tr')).toHaveLength(2)
    expect(w.text()).toContain('A')
    expect(w.text()).not.toContain('C')
    await w.setProps({ page: 3 })
    expect(w.findAll('tbody tr')).toHaveLength(1)
    expect(w.text()).toContain('E')
  })

  it('remote 模式不截行：父级只传当页数据，截了会翻空', () => {
    const w = mount(OsTable, {
      props: { columns, rows: manyRows, remote: true, total: 5, pageSize: 2, page: 2 },
    })
    expect(w.findAll('tbody tr')).toHaveLength(5)
  })

  it('行选择派发 update:selected', async () => {
    const w = mount(OsTable, { props: { columns, rows, selectable: true, selected: [] } })
    const rowCheckbox = w.findAll('tbody input[type="checkbox"]')[0]
    await rowCheckbox.setValue(true)
    expect(w.emitted('update:selected')?.[0]).toEqual([[1]])
  })

  it('空数据渲染 OsEmpty，loading 渲染骨架', () => {
    const empty = mount(OsTable, { props: { columns, rows: [], emptyText: '没有记录' } })
    expect(empty.text()).toContain('没有记录')
    const loading = mount(OsTable, { props: { columns, rows, loading: true } })
    expect(loading.find('[aria-busy="true"]').exists()).toBe(true)
  })

  it('双击行派发 row-dblclick', async () => {
    const w = mount(OsTable, { props: { columns, rows } })
    await w.findAll('tbody tr')[0].trigger('dblclick')
    expect(w.emitted('row-dblclick')?.[0]?.[0]).toMatchObject({ id: 1 })
  })
})

describe('OsPagination', () => {
  it('展示总数并翻页派发 update:modelValue', async () => {
    const w = mount(OsPagination, { props: { modelValue: 1, total: 45, pageSize: 10 } })
    expect(w.text()).toContain('共 45 条')
    const buttons = w.findAll('button')
    const next = buttons[buttons.length - 1]
    await next.trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([2])
  })

  it('首页时上一页禁用', () => {
    const w = mount(OsPagination, { props: { modelValue: 1, total: 45 } })
    expect(w.findAll('button')[0].attributes('disabled')).toBeDefined()
  })
})
