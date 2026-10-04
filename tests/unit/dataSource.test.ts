import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createFixtureDataSource } from '@/kernel/data/fixtureDataSource'
import { createVfsDataSource } from '@/kernel/data/vfsDataSource'
import type { DataSource } from '@/kernel/data/types'
import { useVfs } from '@/kernel/stores/vfs'

interface Row extends Record<string, unknown> {
  name: string
}

interface Harness<T extends Row> {
  ds: DataSource<T>
  seedTotal: number
  idOf: (r: T) => string | number
  nameOf: (r: T) => string
  createOne: (name: string) => Promise<T>
}

const NAMES = ['alpha', 'beta', 'gamma']

function fixtureHarness(): Harness<Row> {
  const seed = NAMES.map((name, i) => ({ id: i + 1, name }))
  const ds = createFixtureDataSource<Row>({ seed, idKey: 'id', textKeys: ['name'] })
  return {
    ds,
    seedTotal: NAMES.length,
    idOf: (r) => r.id as number,
    nameOf: (r) => r.name,
    createOne: (name) => ds.create({ name }),
  }
}

function vfsHarness(): Harness<Row> {
  const vfs = useVfs()
  const now = Date.now()
  const nodes: Record<string, unknown> = {
    '/t': { path: '/t', name: 't', type: 'dir', size: 0, updatedAt: now },
  }
  for (const name of NAMES) {
    nodes[`/t/${name}`] = {
      path: `/t/${name}`,
      name,
      type: 'file',
      size: 1,
      updatedAt: now,
      mime: 'text/plain',
      content: 'x',
    }
  }
  vfs.nodes = nodes as never

  const raw = createVfsDataSource()
  // 契约用例不携带 dir 过滤，此处固定注入 '/t'，让 vfs 实现对齐 fixture 的种子视图
  const ds: DataSource<Row> = {
    query: (q) =>
      raw.query({ ...q, filter: { ...(q.filter ?? {}), dir: '/t' } }) as unknown as Promise<{
        rows: Row[]
        total: number
      }>,
    create: (item) => raw.create(item as never) as unknown as Promise<Row>,
    update: (id, patch) => raw.update(id, patch as never) as unknown as Promise<Row>,
    remove: (id) => raw.remove(id),
  }

  return {
    ds,
    seedTotal: NAMES.length,
    idOf: (r) => r.path as string,
    nameOf: (r) => r.name,
    createOne: (name) => ds.create({ path: `/t/${name}`, type: 'file', content: 'x' }),
  }
}

// 两个实现共用同一套契约断言
function runContract(label: string, make: () => Harness<Row>) {
  describe(`DataSource 契约：${label}`, () => {
    beforeEach(() => setActivePinia(createPinia()))

    it('query 返回 Page 结构且 total 反映种子数量', async () => {
      const h = make()
      const res = await h.ds.query({ page: 1, pageSize: 10 })
      expect(Array.isArray(res.rows)).toBe(true)
      expect(typeof res.total).toBe('number')
      expect(res.total).toBe(h.seedTotal)
    })

    it('分页限制单页行数且 total 不随页码变化', async () => {
      const h = make()
      const p1 = await h.ds.query({ page: 1, pageSize: 2 })
      const p2 = await h.ds.query({ page: 2, pageSize: 2 })
      expect(p1.rows.length).toBeLessThanOrEqual(2)
      expect(p1.total).toBe(h.seedTotal)
      expect(p2.total).toBe(h.seedTotal)
      expect(p1.rows.map(h.nameOf)).not.toEqual(p2.rows.map(h.nameOf))
    })

    it('按 name 升序/降序排序', async () => {
      const h = make()
      const asc = await h.ds.query({ page: 1, pageSize: 10, sort: { key: 'name', order: 'asc' } })
      const desc = await h.ds.query({ page: 1, pageSize: 10, sort: { key: 'name', order: 'desc' } })
      expect(asc.rows.map(h.nameOf)).toEqual([...NAMES].sort((a, b) => a.localeCompare(b, 'zh-CN')))
      expect(desc.rows.map(h.nameOf)).toEqual(
        [...NAMES].sort((a, b) => b.localeCompare(a, 'zh-CN')),
      )
    })

    it('关键字过滤收窄结果', async () => {
      const h = make()
      const res = await h.ds.query({ page: 1, pageSize: 10, keyword: 'alph' })
      expect(res.total).toBe(1)
      expect(h.nameOf(res.rows[0])).toBe('alpha')
    })

    it('create 后 total 增一且可查回', async () => {
      const h = make()
      const before = (await h.ds.query({ page: 1, pageSize: 100 })).total
      const created = await h.createOne('delta')
      expect(h.nameOf(created)).toBe('delta')
      const after = await h.ds.query({ page: 1, pageSize: 100, keyword: 'delta' })
      expect(after.total).toBe(1)
      expect((await h.ds.query({ page: 1, pageSize: 100 })).total).toBe(before + 1)
    })

    it('update 修改字段', async () => {
      const h = make()
      const created = await h.createOne('temp')
      const updated = await h.ds.update(h.idOf(created), { name: 'renamed' } as never)
      expect(h.nameOf(updated)).toBe('renamed')
    })

    it('remove 后 total 减一', async () => {
      const h = make()
      const created = await h.createOne('gone')
      const before = (await h.ds.query({ page: 1, pageSize: 100 })).total
      await h.ds.remove(h.idOf(created))
      const after = (await h.ds.query({ page: 1, pageSize: 100 })).total
      expect(after).toBe(before - 1)
    })
  })
}

runContract('fixtureDataSource', fixtureHarness)
runContract('vfsDataSource', vfsHarness)

describe('fixtureDataSource 异常路径（供乐观回滚与 error 三态）', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('failWhen 为真时 query 与变更均 reject', async () => {
    let fail = false
    const ds = createFixtureDataSource<Row>({
      seed: NAMES.map((name, i) => ({ id: i + 1, name })),
      idKey: 'id',
      failWhen: () => fail,
    })
    await expect(ds.query({ page: 1, pageSize: 10 })).resolves.toBeTruthy()
    fail = true
    await expect(ds.query({ page: 1, pageSize: 10 })).rejects.toThrow()
    await expect(ds.remove(1)).rejects.toThrow()
  })
})
