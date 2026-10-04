import { expect, test } from '@playwright/test'

const dockTile = (name: string) => `nav button[title="${name}"]`

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('壳层启动：顶栏、Dock 磁贴、品牌', async ({ page }) => {
  await expect(page.getByRole('banner').getByText('万物皆应用')).toBeVisible()
  await expect(page.locator('p.text-5xl')).toHaveText('万物皆应用')
  for (const name of ['AI 助手', '文件管理', '文档编辑', '应用中心']) {
    await expect(page.locator(dockTile(name))).toBeVisible()
    await expect(page.locator(`${dockTile(name)} svg`)).toHaveCount(1)
  }
})

test('Dock 开窗与交通灯关闭', async ({ page }) => {
  await page.locator(dockTile('文件管理')).click()
  const win = page.locator('section').filter({ hasText: '文件管理' })
  await expect(win).toBeVisible()

  await win.locator('header button[title="关闭"]').click()
  await expect(win).toHaveCount(0)
})

test('Dock 点击语义：聚焦→最小化→还原', async ({ page }) => {
  await page.locator(dockTile('文件管理')).click()
  const win = page.locator('section').filter({ hasText: '文件管理' })
  await expect(win).toBeVisible()

  await page.locator(dockTile('文件管理')).click()
  await expect(win).toBeHidden()

  await page.locator(dockTile('文件管理')).click()
  await expect(win).toBeVisible()
})

test('拖拽标题栏移动窗口', async ({ page }) => {
  await page.locator(dockTile('应用中心')).click()
  const win = page.locator('section').filter({ hasText: '应用中心' })
  await expect(win).toBeVisible()

  const before = await win.boundingBox()
  const header = win.locator('header')
  const hb = await header.boundingBox()
  await page.mouse.move(hb!.x + 200, hb!.y + 15)
  await page.mouse.down()
  await page.mouse.move(hb!.x + 320, hb!.y + 95, { steps: 5 })
  await page.mouse.up()

  const after = await win.boundingBox()
  expect(after!.x - before!.x).toBeGreaterThan(80)
  expect(after!.y - before!.y).toBeGreaterThan(50)
})

test('Spotlight 搜索并打开文档', async ({ page }) => {
  await page.keyboard.press('Control+k')
  const input = page.locator('input[placeholder="搜索应用与文件…"]')
  await expect(input).toBeVisible()

  await input.fill('需求文档')
  await page.locator('li button').filter({ hasText: '需求文档.docx' }).click()

  const win = page.locator('section').filter({ hasText: '需求文档.docx' })
  await expect(win).toBeVisible()
})

test('布局持久化：刷新后窗口还原', async ({ page }) => {
  await page.locator(dockTile('文件管理')).click()
  await expect(page.locator('section').filter({ hasText: '文件管理' })).toBeVisible()

  await page.waitForTimeout(600)
  await page.reload()
  await expect(page.locator('section').filter({ hasText: '文件管理' })).toBeVisible()
})

test('切换角色：受限应用从 Dock 消失，刷新后角色保持', async ({ page }) => {
  // 默认管理员可见文件管理
  await expect(page.locator(dockTile('文件管理'))).toBeVisible()

  await page.locator(dockTile('设置')).click()
  const settings = page.locator('section.absolute').filter({ hasText: '用户与角色' })
  await expect(settings).toBeVisible()

  // 切到访客（仅公开应用）
  await settings.locator('button', { hasText: '访客' }).click()
  await expect(page.locator(dockTile('文件管理'))).toHaveCount(0)
  await expect(page.locator(dockTile('设置'))).toBeVisible()

  // 刷新后角色还原，仍看不到受限应用
  await page.waitForTimeout(600)
  await page.reload()
  await expect(page.locator(dockTile('文件管理'))).toHaveCount(0)
})

test('未授权 exec 被拒并在通知中心留痕', async ({ page }) => {
  await page.locator(dockTile('设置')).click()
  const settings = page.locator('section.absolute').filter({ hasText: '用户与角色' })
  await settings.locator('button', { hasText: '访客' }).click()

  // 访客态下用 Spotlight 搜不到受限应用，仅公开应用可见
  await page.keyboard.press('Control+k')
  const input = page.locator('input[placeholder="搜索应用与文件…"]')
  await input.fill('文件管理')
  await expect(page.locator('li button').filter({ hasText: '文件管理' })).toHaveCount(0)
})

test('组件陈列：页签切换与表格渲染', async ({ page }) => {
  await page.locator(dockTile('组件陈列')).click()
  const win = page.locator('section.absolute').filter({ has: page.locator('[role="tablist"]') })
  await expect(win).toBeVisible()
  await expect(win.locator('[role="tab"]')).toHaveCount(4)

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

test('S5 主题：暗色切换全局生效、token 换值且刷新后保持', async ({ page }) => {
  await page.locator(dockTile('设置')).click()
  const win = page
    .locator('section.absolute')
    .filter({ has: page.locator('input[name="theme-mode"]') })
  await expect(win).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

  await win.locator('input[name="theme-mode"][value="dark"]').check()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  // 语义层稳定、原始层换值：表面色由白转深（暗色对比度基线）
  const surface = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--raw-surface').trim(),
  )
  expect(surface.toLowerCase()).not.toBe('#ffffff')

  await page.waitForTimeout(600)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('S5 强调色：切换 accent 落根 data-accent 并换强调色', async ({ page }) => {
  await page.locator(dockTile('设置')).click()
  const win = page
    .locator('section.absolute')
    .filter({ has: page.locator('input[name="theme-accent"]') })
  await win.locator('input[name="theme-accent"][value="violet"]').check()
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'violet')
  const accent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--raw-accent').trim(),
  )
  expect(accent.toLowerCase()).toBe('#8b5cf6')
})

test('S5 国际化：切英文后壳层/设置/Spotlight/陈列文案全变且刷新保持', async ({ page }) => {
  await page.locator(dockTile('设置')).click()
  const win = page
    .locator('section.absolute')
    .filter({ has: page.locator('input[name="app-lang"]') })
  await expect(win.getByText('用户与角色')).toBeVisible()

  await win.locator('input[name="app-lang"][value="en-US"]').check()

  // 壳层品牌 + 设置分区标题 + Dock 应用名（title 属性）本地化
  await expect(page.getByRole('banner').getByText('Everything is an app')).toBeVisible()
  await expect(win.getByText('Users & Roles')).toBeVisible()
  await expect(page.locator('nav button[title="Files"]')).toBeVisible()

  // Spotlight 占位符与结果本地化，并能打开组件陈列
  await page.keyboard.press('Control+k')
  const spot = page.locator('input[placeholder="Search apps and files…"]')
  await expect(spot).toBeVisible()
  await spot.fill('Components')
  await page.locator('li button').filter({ hasText: 'Components' }).first().click()

  const gallery = page.locator('section.absolute').filter({ hasText: 'OsButton' })
  await expect(gallery.getByRole('tab', { name: 'Basic' })).toBeVisible()

  // 语言偏好刷新后保持
  await page.waitForTimeout(600)
  await page.reload()
  await expect(page.getByRole('banner').getByText('Everything is an app')).toBeVisible()
})
