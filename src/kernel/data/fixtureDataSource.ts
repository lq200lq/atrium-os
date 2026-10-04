import { delay, reportError } from './errors'
import { applyQuery, type DataSource, type Page, type Query } from './types'

export interface FixtureOptions<T> {
  /** 本地 JSON 种子数据（内存副本，不起 mock server） */
  seed: T[]
  /** 模拟网络时延，用于展示 loading 三态 */
  latency?: number
  /** 返回 true 时所有操作 reject，用于展示 error 三态与可重试 */
  failWhen?: () => boolean
  /** 主键字段名，缺省 'id' */
  idKey?: keyof T & string
  /** 参与关键字模糊匹配的文本字段 */
  textKeys?: (keyof T & string)[]
}

/**
 * 基于本地种子数据的内存数据源：分页/排序/过滤语义与 vfsDataSource 共用 applyQuery。
 * 用于脚手架参考页面（data-board），无需后端。
 */
export function createFixtureDataSource<T extends Record<string, unknown>>(
  opts: FixtureOptions<T>,
): DataSource<T> {
  const idKey = opts.idKey ?? ('id' as keyof T & string)
  const textKeys = opts.textKeys ?? []
  const latency = opts.latency ?? 0
  let rows: T[] = [...opts.seed]
  let seq = rows.length

  async function gate(op: string): Promise<void> {
    if (latency > 0) await delay(latency)
    if (opts.failWhen?.()) {
      const err = new Error(`${op} 失败（模拟异常）`)
      reportError('数据操作失败', err)
      throw err
    }
  }

  return {
    async query(q: Query): Promise<Page<T>> {
      await gate('查询')
      return applyQuery(rows, q, textKeys)
    },

    async create(item: Partial<T>): Promise<T> {
      await gate('新增')
      seq += 1
      const created = { ...item, [idKey]: (item[idKey] as string | number) ?? seq } as T
      rows = [created, ...rows]
      return created
    },

    async update(id: string | number, patch: Partial<T>): Promise<T> {
      await gate('更新')
      const idx = rows.findIndex((r) => String(r[idKey]) === String(id))
      if (idx === -1) {
        const err = new Error(`记录不存在: ${String(id)}`)
        reportError('更新失败', err)
        throw err
      }
      const next = { ...rows[idx], ...patch } as T
      rows = rows.map((r, i) => (i === idx ? next : r))
      return next
    },

    async remove(id: string | number): Promise<void> {
      await gate('删除')
      rows = rows.filter((r) => String(r[idKey]) !== String(id))
    },
  }
}
