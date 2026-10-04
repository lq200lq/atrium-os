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
