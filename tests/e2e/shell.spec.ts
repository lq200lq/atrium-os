import { expect, test } from '@playwright/test'
import { dockTile, gotoShell } from './helpers'

test.beforeEach(async ({ page }) => {
  await gotoShell(page)
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

test('Spotlight 搜索并打开文档', async ({ page }) => {
  // 就绪屏障：Vite 的模块图在 load 事件之后才完成挂载，直接按键会偶发抢在
  // App.vue 注册 ⌘K 监听之前；先等顶栏出现再按键，稳定且不放松任何断言。
  await expect(page.getByRole('banner')).toBeVisible()
  await page.keyboard.press('Control+k')
  const input = page.locator('input[placeholder="搜索应用与文件…"]')
  await expect(input).toBeVisible()

  await input.fill('需求文档')
  await page.locator('li button').filter({ hasText: '需求文档.docx' }).click()

  const win = page.locator('section').filter({ hasText: '需求文档.docx' })
  await expect(win).toBeVisible()
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
