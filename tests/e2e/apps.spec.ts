import { expect, test } from '@playwright/test'
import { dockTile, gotoShell } from './helpers'

test.beforeEach(async ({ page }) => {
  await gotoShell(page)
})

test('组件陈列：页签切换与表格渲染', async ({ page }) => {
  await page.locator(dockTile('组件陈列')).click()
  const win = page.locator('section.absolute').filter({ has: page.locator('[role="tablist"]') })
  await expect(win).toBeVisible()
  // S11 新增「作用域配置」页签后共 7 个；按名断言，避免只数个数时漏掉「加了又漏了某个」
  await expect(win.locator('[role="tab"]')).toHaveText([
    '基础',
    '录入',
    '布局',
    '展示',
    '导航',
    '反馈',
    '作用域配置',
  ])

  await win.locator('[role="tab"]', { hasText: '展示' }).click()
  await expect(win.locator('thead th', { hasText: '姓名' })).toBeVisible()
  await expect(win.locator('tbody tr')).toHaveCount(3)
})

test('文件管理改用 OsTable 渲染并保留新建目录表单', async ({ page }) => {
  await page.locator(dockTile('文件管理')).click()
  const win = page.locator('section.absolute').filter({ hasText: '修改时间' })
  await expect(win.locator('thead th', { hasText: '名称' })).toBeVisible()
  await expect(win.locator('tbody tr').first()).toBeVisible()

  await win.locator('button', { hasText: '新建目录' }).click()
  await expect(win.locator('form input')).toBeVisible()
})

test('数据看板：分页/筛选/排序经统一契约驱动', async ({ page }) => {
  await page.locator(dockTile('数据看板')).click()
  const win = page.locator('section.absolute').filter({ hasText: '入职日期' })
  await expect(win.locator('thead th', { hasText: '姓名' })).toBeVisible()

  // 首页 8 行、共 20 条
  await expect(win.locator('tbody tr')).toHaveCount(8)
  await expect(win.getByText('共 20 条')).toBeVisible()

  // 部门筛选：技术部 7 人
  await win.locator('select').selectOption('技术部')
  await expect(win.getByText('共 7 条')).toBeVisible()

  // 复位部门 + 关键字搜索：张 → 1 条
  await win.locator('select').selectOption('')
  await win.locator('input[placeholder="搜索姓名/职位"]').fill('张')
  await win.locator('button', { hasText: '查询' }).click()
  await expect(win.getByText('共 1 条')).toBeVisible()

  // 清空关键字恢复全量
  await win.locator('input[placeholder="搜索姓名/职位"]').fill('')
  await win.locator('button', { hasText: '查询' }).click()
  await expect(win.getByText('共 20 条')).toBeVisible()

  // 排序：点击薪资表头出现升/降序标记
  await win.locator('thead th', { hasText: '薪资' }).click()
  await expect(
    win.locator('thead th', { hasText: '薪资' }).locator('span.text-accent-strong'),
  ).toBeVisible()
})

test('数据看板：异常三态可重试与增删改（乐观回滚）', async ({ page }) => {
  await page.locator(dockTile('数据看板')).click()
  const win = page.locator('section.absolute').filter({ hasText: '入职日期' })
  await expect(win.getByText('共 20 条')).toBeVisible()

  // 模拟异常 → error 三态 + 重试出口
  await win.getByRole('switch').click()
  await expect(win.getByText('查询 失败（模拟异常）')).toBeVisible()
  await expect(win.locator('button', { hasText: '重试' })).toBeVisible()

  // 关闭异常 → 自动恢复
  await win.getByRole('switch').click()
  await expect(win.getByText('共 20 条')).toBeVisible()

  // 新增
  await win.locator('button', { hasText: '新增' }).click()
  const dialog = win.locator('form')
  await dialog.locator('input').nth(0).fill('测试员工')
  await dialog.locator('input').nth(1).fill('实习生')
  await win.locator('button', { hasText: '确定' }).click()
  await expect(win.getByText('共 21 条')).toBeVisible()

  // 删除首行（乐观更新，成功即生效）
  await win.locator('tbody tr').first().locator('button', { hasText: '删除' }).click()
  await expect(win.getByText('共 20 条')).toBeVisible()
})
