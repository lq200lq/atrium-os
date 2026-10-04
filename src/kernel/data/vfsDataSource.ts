import { useVfs } from '../stores/vfs'
import { baseName, parentOf, TRASH_ROOT, type FsNode } from '../fs/types'
import { reportError } from './errors'
import { applyQuery, type DataSource, type Page, type Query } from './types'

type Row = FsNode & Record<string, unknown>

/**
 * 包装现有 VFS store 的数据源，让 file-manager 经统一契约读写。
 * query 的 filter 约定：{ dir?: string; trash?: boolean }；主键为节点 path。
 * VFS 为同步响应式 store，此处以 Promise 包裹以对齐 DataSource 契约；不额外上报变更（store 内部已 emit vfs:changed）。
 */
export function createVfsDataSource(): DataSource<FsNode> {
  const asRow = (nodes: FsNode[]) => nodes as unknown as Row[]

  return {
    async query(q: Query): Promise<Page<FsNode>> {
      const vfs = useVfs()
      const trash = q.filter?.trash === true
      const dir = (q.filter?.dir as string) ?? '/我的文件'
      const base = trash ? vfs.trash : vfs.ls(dir)
      // dir/trash 为数据源寻址参数，非 FsNode 字段，须在 applyQuery 前剔除，否则会按不存在的字段过滤掉全部行
      const {
        dir: _dir,
        trash: _trash,
        ...restFilter
      } = (q.filter ?? {}) as Record<string, unknown>
      void _dir
      void _trash
      const page = applyQuery(asRow(base), { ...q, filter: restFilter }, ['name'])
      return { rows: page.rows as FsNode[], total: page.total }
    },

    async create(item: Partial<FsNode>): Promise<FsNode> {
      const vfs = useVfs()
      const target = item.path
      if (!target) {
        const err = new Error('create 需要 item.path（目标完整路径）')
        reportError('新建失败', err)
        throw err
      }
      const dir = parentOf(target)
      const name = baseName(target)
      const path =
        item.type === 'dir'
          ? vfs.mkdir(dir, name)
          : vfs.writeFile(dir, name, item.content ?? '', item.mime ?? 'text/plain')
      return vfs.byPath(path) as FsNode
    },

    async update(id: string | number, patch: Partial<FsNode>): Promise<FsNode> {
      const vfs = useVfs()
      const path = String(id)
      if (patch.name !== undefined && patch.name !== vfs.byPath(path)?.name) {
        // 目标路径须在 rename 前算出：rename 会移动子树，事后再算将命中已存在的目标而追加序号
        const target = vfs.uniquePath(parentOf(path), patch.name, path)
        vfs.rename(path, patch.name)
        return vfs.byPath(target) as FsNode
      }
      if (patch.content !== undefined) {
        vfs.updateContent(path, patch.content)
      }
      return vfs.byPath(path) as FsNode
    },

    async remove(id: string | number): Promise<void> {
      useVfs().remove(String(id))
    },
  }
}

export { TRASH_ROOT }
