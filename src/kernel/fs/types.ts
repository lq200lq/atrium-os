export interface FsNode {
  path: string
  name: string
  type: 'dir' | 'file'
  size: number
  updatedAt: number
  mime?: string
  content?: string
  trashedFrom?: string
}

export interface VfsChangeEvent {
  type: 'mkdir' | 'write' | 'rename' | 'remove' | 'restore'
  path: string
  from?: string
}

export const TRASH_ROOT = '/回收站'

export function baseName(path: string): string {
  return path.split('/').pop() ?? path
}

export function parentOf(path: string): string {
  const parts = path.split('/')
  parts.pop()
  return parts.join('/') || '/'
}

export function isUnderTrash(path: string): boolean {
  return path === TRASH_ROOT || path.startsWith(`${TRASH_ROOT}/`)
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
