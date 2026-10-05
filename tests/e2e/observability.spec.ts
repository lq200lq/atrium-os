import { expect, test } from '@playwright/test'
import { dockTile, gotoShell } from './helpers'

test.beforeEach(async ({ page }) => {
  await gotoShell(page)
})

test('S6 错误边界：应用崩溃不拖垮壳层，窗口显示错误态可重载并在设置留痕', async ({ page }) => {
  await page.locator(dockTile('组件陈列')).click()
  const gallery = page.locator('section.absolute').filter({ has: page.locator('[role="tablist"]') })
  await gallery.getByRole('tab', { name: '反馈' }).click()

  // 触发应用渲染期抛错
  await gallery.getByRole('button', { name: '模拟应用崩溃' }).click()

  // 窗口内就地显示错误态（tablist 已被错误态替换），壳层（顶栏/Dock）仍存活
  const crashed = page.locator('section.absolute').filter({ hasText: '应用出错了' })
  await expect(crashed.getByText('应用出错了')).toBeVisible()
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.locator(dockTile('组件陈列'))).toBeVisible()

  // 重新加载后应用恢复
  await crashed.getByRole('button', { name: '重新加载' }).click()
  await expect(gallery.getByRole('tab', { name: '反馈' })).toBeVisible()

  // 错误已在设置「诊断日志」留痕
  await page.locator(dockTile('设置')).click()
  const settings = page.locator('section.absolute').filter({ hasText: '用户与角色' })
  await expect(settings.getByText('诊断日志')).toBeVisible()
  await expect(settings.getByText('CrashProbe')).toBeVisible()
})
