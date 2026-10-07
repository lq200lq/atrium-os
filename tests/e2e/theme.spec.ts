import { expect, test } from '@playwright/test'
import { dockTile, gotoShell } from './helpers'

test.beforeEach(async ({ page }) => {
  await gotoShell(page)
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
  await expect(page.getByRole('banner').getByText('Atrium OS')).toBeVisible()
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
  await expect(page.getByRole('banner').getByText('Atrium OS')).toBeVisible()
})
