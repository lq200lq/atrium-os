import { describe, expect, it } from 'vitest'
import type { FsNode } from '@/kernel/fs/types'
import { ICON_MAP, fileIconClass, fileIconName, type IconName } from '@/kernel/icons'

function node(patch: Partial<FsNode>): FsNode {
  return {
    path: '/我的文件/占位',
    name: '占位',
    type: 'file',
    size: 0,
    updatedAt: 0,
    ...patch,
  }
}

describe('fileIconName / fileIconClass', () => {
  const cases: [Partial<FsNode>, IconName, string][] = [
    [{ type: 'dir', path: '/我的文件/技术文档', name: '技术文档' }, 'folder', 'text-file-dir'],
    [{ name: '需求文档.docx' }, 'file-text', 'text-file-docx'],
    [{ name: '数据报表.xlsx' }, 'file-spreadsheet', 'text-file-xlsx'],
    [{ name: '项目汇报.pptx' }, 'presentation', 'text-file-pptx'],
    [{ name: '合同文件.pdf' }, 'scroll-text', 'text-file-pdf'],
    [{ name: '未知文件.xyz' }, 'file', 'text-file-other'],
  ]

  it.each(cases)('映射 %o', (patch, iconName, cls) => {
    const n = node(patch)
    expect(fileIconName(n)).toBe(iconName)
    expect(fileIconClass(n)).toBe(cls)
  })

  it('扩展名大小写不敏感', () => {
    expect(fileIconName(node({ name: '报表.XLSX' }))).toBe('file-spreadsheet')
  })
})

describe('ICON_MAP', () => {
  it('所有键都有组件实现', () => {
    for (const [name, comp] of Object.entries(ICON_MAP)) {
      expect(comp, name).toBeTruthy()
    }
  })
})
