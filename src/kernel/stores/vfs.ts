import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import { commandBus } from '../bus/commandBus'
import { idbGet, idbSet } from '../fs/idb'
import {
  baseName,
  isUnderTrash,
  parentOf,
  TRASH_ROOT,
  type FsNode,
  type VfsChangeEvent,
} from '../fs/types'

const FS_KEY = 'fs-v1'

function seed(): Record<string, FsNode> {
  const now = Date.now()
  const nodes: Record<string, FsNode> = {}
  const dir = (path: string) => {
    nodes[path] = { path, name: baseName(path), type: 'dir', size: 0, updatedAt: now }
  }
  const file = (path: string, content: string, mime: string) => {
    nodes[path] = {
      path,
      name: baseName(path),
      type: 'file',
      size: new TextEncoder().encode(content).length,
      updatedAt: now,
      mime,
      content,
    }
  }

  dir('/我的文件')
  dir(TRASH_ROOT)
  dir('/我的文件/产品方案')
  dir('/我的文件/技术文档')
  dir('/我的文件/项目资料')
  dir('/我的文件/设计素材')
  file(
    '/我的文件/项目汇报.pptx',
    '智慧园区项目汇报提纲（占位内容）',
    'application/vnd.ms-powerpoint',
  )
  file(
    '/我的文件/需求文档.docx',
    '智慧园区数字化解决方案需求说明（占位内容）',
    'application/msword',
  )
  file('/我的文件/数据报表.xlsx', '园区运营数据报表（占位内容）', 'application/vnd.ms-excel')
  file('/我的文件/合同文件.pdf', '园区服务合同（占位内容）', 'application/pdf')
  return nodes
}

export const useVfs = defineStore('vfs', {
  state: () => ({
    nodes: {} as Record<string, FsNode>,
    ready: false,
  }),
  getters: {
    ls: (state) => (dir: string) =>
      Object.values(state.nodes)
        .filter((n) => parentOf(n.path) === dir && (isUnderTrash(dir) || !n.trashedFrom))
        .sort((a, b) =>
          a.type === b.type ? a.name.localeCompare(b.name, 'zh-CN') : a.type === 'dir' ? -1 : 1,
        ),
    trash: (state) =>
      Object.values(state.nodes)
        .filter((n) => n.trashedFrom && parentOf(n.path) === TRASH_ROOT)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    byPath: (state) => (path: string) => state.nodes[path],
  },
  actions: {
    async init() {
      try {
        const saved = await idbGet<Record<string, FsNode>>(FS_KEY)
        if (saved && Object.keys(saved).length > 0) {
          this.nodes = saved
        } else {
          this.nodes = seed()
          await this.persist()
        }
      } catch (e) {
        console.error('[vfs] IndexedDB 不可用，降级为内存模式', e)
        if (Object.keys(this.nodes).length === 0) this.nodes = seed()
      }
      this.ready = true
    },

    /** 落库结果要能被调用方判：小组件数据靠它做「乐观写 → 失败回滚」（§4.2 规则 2） */
    async persist(): Promise<boolean> {
      try {
        await idbSet(FS_KEY, toRaw(this.nodes))
        return true
      } catch (e) {
        console.warn('[vfs] 持久化失败，仅保留内存数据', e)
        return false
      }
    },

    uniquePath(dir: string, name: string, ignore?: string): string {
      let path = `${dir}/${name}`
      let i = 2
      while (this.nodes[path] && path !== ignore) {
        path = `${dir}/${name} ${i++}`
      }
      return path
    },

    mkdir(dir: string, name: string): string {
      const path = this.uniquePath(dir, name)
      this.nodes[path] = { path, name: baseName(path), type: 'dir', size: 0, updatedAt: Date.now() }
      void this.persist()
      this.changed('mkdir', path)
      return path
    },

    writeFile(dir: string, name: string, content = '', mime = 'text/plain'): string {
      const path = this.uniquePath(dir, name)
      this.nodes[path] = {
        path,
        name: baseName(path),
        type: 'file',
        size: new TextEncoder().encode(content).length,
        updatedAt: Date.now(),
        mime,
        content,
      }
      void this.persist()
      this.changed('write', path)
      return path
    },

    updateContent(path: string, content: string) {
      const node = this.nodes[path]
      if (!node || node.type !== 'file') return
      node.content = content
      node.size = new TextEncoder().encode(content).length
      node.updatedAt = Date.now()
      void this.persist()
      this.changed('write', path)
    },

    rename(path: string, newName: string) {
      const node = this.nodes[path]
      const clean = newName.trim()
      if (!node || !clean || clean === node.name) return
      const target = this.uniquePath(parentOf(path), clean, path)
      this.moveSubtree(path, target)
      void this.persist()
      this.changed('rename', target, path)
    },

    remove(path: string) {
      const node = this.nodes[path]
      if (!node || isUnderTrash(path) || path === '/') return
      const target = this.uniquePath(TRASH_ROOT, node.name, path)
      this.moveSubtree(path, target, { trashedFrom: parentOf(path) })
      void this.persist()
      this.changed('remove', target)
    },

    restore(trashPath: string) {
      const node = this.nodes[trashPath]
      if (!node?.trashedFrom) return
      const target = this.uniquePath(node.trashedFrom, node.name, trashPath)
      this.moveSubtree(trashPath, target, { trashedFrom: undefined })
      void this.persist()
      this.changed('restore', target)
    },

    changed(type: VfsChangeEvent['type'], path: string, from?: string) {
      commandBus.emit('vfs:changed', { type, path, from } satisfies VfsChangeEvent)
    },

    moveSubtree(from: string, to: string, patch?: Partial<FsNode>) {
      const prefix = `${from}/`
      const entries = Object.values(this.nodes).filter(
        (n) => n.path === from || n.path.startsWith(prefix),
      )
      for (const n of entries) {
        const newPath = to + n.path.slice(from.length)
        delete this.nodes[n.path]
        this.nodes[newPath] = {
          ...n,
          ...patch,
          path: newPath,
          name: newPath === to ? baseName(to) : n.name,
          updatedAt: Date.now(),
        }
      }
    },
  },
})
