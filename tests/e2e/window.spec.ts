import { expect, test } from '@playwright/test'
import { dockTile, gotoShell } from './helpers'

test.beforeEach(async ({ page }) => {
  await gotoShell(page)
})

test('Dock 开窗与交通灯关闭', async ({ page }) => {
  await page.locator(dockTile('文件管理')).click()
  const win = page.locator('section').filter({ hasText: '文件管理' })
  await expect(win).toBeVisible()

  await win.locator('header button[title="关闭"]').click()
  await expect(win).toHaveCount(0)
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

test('布局持久化：刷新后窗口还原', async ({ page }) => {
  await page.locator(dockTile('文件管理')).click()
  await expect(page.locator('section').filter({ hasText: '文件管理' })).toBeVisible()

  await page.waitForTimeout(600)
  await page.reload()
  await expect(page.locator('section').filter({ hasText: '文件管理' })).toBeVisible()
})
