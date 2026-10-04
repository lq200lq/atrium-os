import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { TRASH_ROOT } from '@/kernel/fs/types'
import { useVfs } from '@/kernel/stores/vfs'

const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))

vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value)
  }),
}))

const HOME = '/我的文件'

describe('vfs', () => {
  beforeEach(() => {
    idbStore.clear()
    setActivePinia(createPinia())
  })

  it('空库时 init 播种种子数据', async () => {
    const vfs = useVfs()
    await vfs.init()
    expect(vfs.ready).toBe(true)
    expect(vfs.byPath(HOME)?.type).toBe('dir')
    const items = vfs.ls(HOME)
    expect(items.slice(0, 4).every((n) => n.type === 'dir')).toBe(true)
    expect(
      items
        .filter((n) => n.type === 'file')
        .map((n) => n.name)
        .sort(),
    ).toEqual(['合同文件.pdf', '数据报表.xlsx', '需求文档.docx', '项目汇报.pptx'].sort())
  })

  it('已有存档时 init 不覆盖', async () => {
    idbStore.set('fs-v1', {
      '/自定义': { path: '/自定义', name: '自定义', type: 'dir', size: 0, updatedAt: 1 },
    })
    const vfs = useVfs()
    await vfs.init()
    expect(vfs.byPath('/自定义')).toBeTruthy()
    expect(vfs.byPath(HOME)).toBeUndefined()
  })

  it('重名自动去重', async () => {
    const vfs = useVfs()
    await vfs.init()
    const p = vfs.writeFile(HOME, '需求文档.docx', 'x')
    expect(p).toBe(`${HOME}/需求文档.docx 2`)
    expect(vfs.mkdir(HOME, '技术文档')).toBe(`${HOME}/技术文档 2`)
  })

  it('rename 移动整棵子树', async () => {
    const vfs = useVfs()
    await vfs.init()
    const sub = vfs.mkdir(`${HOME}/技术文档`, '子目录')
    vfs.writeFile(sub, '笔记.docx', 'abc')
    vfs.rename(`${HOME}/技术文档`, '归档文档')
    expect(vfs.byPath(`${HOME}/归档文档`)).toBeTruthy()
    expect(vfs.byPath(`${HOME}/归档文档/子目录`)).toBeTruthy()
    expect(vfs.byPath(`${HOME}/归档文档/子目录/笔记.docx`)).toBeTruthy()
    expect(vfs.byPath(`${HOME}/技术文档`)).toBeUndefined()
  })

  it('remove 进回收站并从列表隐藏', async () => {
    const vfs = useVfs()
    await vfs.init()
    const path = `${HOME}/需求文档.docx`
    vfs.remove(path)
    expect(vfs.byPath(path)).toBeUndefined()
    const [trashed] = vfs.trash
    expect(trashed?.name).toBe('需求文档.docx')
    expect(trashed?.trashedFrom).toBe(HOME)
    expect(vfs.ls(HOME).some((n) => n.name === '需求文档.docx')).toBe(false)
  })

  it('restore 还原到原目录', async () => {
    const vfs = useVfs()
    await vfs.init()
    vfs.remove(`${HOME}/需求文档.docx`)
    vfs.restore(`${TRASH_ROOT}/需求文档.docx`)
    expect(vfs.byPath(`${HOME}/需求文档.docx`)?.type).toBe('file')
    expect(vfs.trash).toHaveLength(0)
  })

  it('还原时原名被占用则去重', async () => {
    const vfs = useVfs()
    await vfs.init()
    vfs.remove(`${HOME}/需求文档.docx`)
    vfs.writeFile(HOME, '需求文档.docx', '新的')
    vfs.restore(`${TRASH_ROOT}/需求文档.docx`)
    expect(vfs.byPath(`${HOME}/需求文档.docx 2`)).toBeTruthy()
  })

  it('回收站内不可再删除', async () => {
    const vfs = useVfs()
    await vfs.init()
    vfs.remove(`${HOME}/需求文档.docx`)
    vfs.remove(`${TRASH_ROOT}/需求文档.docx`)
    expect(vfs.trash).toHaveLength(1)
  })

  it('updateContent 同步 size', async () => {
    const vfs = useVfs()
    await vfs.init()
    const path = vfs.writeFile(HOME, '笔记.txt', 'abc')
    vfs.updateContent(path, 'abcdef')
    expect(vfs.byPath(path)?.size).toBe(6)
  })

  it('目录删除连带子树进回收站', async () => {
    const vfs = useVfs()
    await vfs.init()
    vfs.writeFile(`${HOME}/技术文档`, '架构.docx', 'x')
    vfs.remove(`${HOME}/技术文档`)
    expect(vfs.byPath(`${TRASH_ROOT}/技术文档/架构.docx`)).toBeTruthy()
    expect(vfs.trash.map((n) => n.name)).toEqual(['技术文档'])
  })
})
