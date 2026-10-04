export interface SortSpec {
  key: string
  order: 'asc' | 'desc'
}

export interface Query {
  page: number
  pageSize: number
  sort?: SortSpec
  /** 精确匹配过滤：键为字段名，值为期望值（undefined 表示不过滤该键） */
  filter?: Record<string, unknown>
  /** 关键字模糊匹配（对各实现的文本字段生效） */
  keyword?: string
}

export interface Page<T> {
  rows: T[]
  total: number
}

/**
 * 统一数据访问契约：应用只消费此接口，将来接后端只换实现。
 * 变更方法在失败时 reject，调用方据此回滚乐观更新；错误已由实现集中上报（console.warn + 通知中心）。
 */
export interface DataSource<T> {
  query(q: Query): Promise<Page<T>>
  create(item: Partial<T>): Promise<T>
  update(id: string | number, patch: Partial<T>): Promise<T>
  remove(id: string | number): Promise<void>
}

/** 供 fixture/vfs 等本地实现复用的分页 + 排序 + 关键字/过滤纯函数，保证两实现语义一致 */
export function applyQuery<T extends Record<string, unknown>>(
  rows: T[],
  q: Query,
  textKeys: (keyof T & string)[],
): Page<T> {
  let out = rows

  if (q.filter) {
    for (const [k, v] of Object.entries(q.filter)) {
      if (v === undefined || v === '' || v === null) continue
      out = out.filter((r) => String(r[k]) === String(v))
    }
  }

  if (q.keyword) {
    const kw = q.keyword.trim().toLowerCase()
    if (kw) {
      out = out.filter((r) =>
        textKeys.some((k) =>
          String(r[k] ?? '')
            .toLowerCase()
            .includes(kw),
        ),
      )
    }
  }

  const total = out.length

  if (q.sort) {
    const { key, order } = q.sort
    const dir = order === 'asc' ? 1 : -1
    out = [...out].sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      if (av == null && bv == null) return 0
      if (av == null) return -1 * dir
      if (bv == null) return 1 * dir
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv), 'zh-CN') * dir
    })
  }

  const start = (q.page - 1) * q.pageSize
  return { rows: out.slice(start, start + q.pageSize), total }
}
