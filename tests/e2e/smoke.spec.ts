import { expect, test } from '@playwright/test'
import { dockTile, gotoShell } from './helpers'

test.beforeEach(async ({ page }) => {
  await gotoShell(page)
})

test('壳层启动：顶栏、Dock 磁贴、品牌', async ({ page }) => {
  await expect(page.getByRole('banner').getByText('Atrium OS')).toBeVisible()
  await expect(page.locator('p.text-display-1')).toHaveText('Atrium OS')
  for (const name of ['AI 助手', '文件管理', '文档编辑', '应用中心']) {
    await expect(page.locator(dockTile(name))).toBeVisible()
    await expect(page.locator(`${dockTile(name)} svg`)).toHaveCount(1)
  }
})

test('应用中心锚定在 Dock 最左侧，与常规应用用分割线隔开', async ({ page }) => {
  await expect(page.locator('nav button[title]').first()).toHaveAttribute('title', '应用中心')
  await expect(page.locator('[data-dock-divider]')).toHaveCount(1)
})
