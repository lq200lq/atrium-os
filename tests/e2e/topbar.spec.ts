import { expect, test } from '@playwright/test'
import { gotoShell } from './helpers'

/**
 * 顶栏菜单精简（开源标准轮）：死按钮下线后，仅存的两个下拉必须真有动作——
 * 帮助 → 关于本系统要落设置的系统信息段（含许可与仓库），视图 → 显示桌面要拨开关。
 */

test('顶栏 帮助 → 关于本系统：开设置并落到系统信息段', async ({ page }) => {
  await gotoShell(page)
  await page.getByRole('button', { name: '帮助' }).click()
  await page.getByRole('menuitem', { name: '关于本系统' }).click()

  const system = page.locator('[data-section="system"]')
  await expect(system).toBeVisible()
  await expect(system).toBeInViewport()
  // 关于面板三项：版本号在段内、许可证与源码仓库随面板呈现
  await expect(system.getByText('Apache-2.0')).toBeVisible()
  await expect(system.getByRole('link', { name: 'github.com/lq200lq/atrium-os' })).toHaveAttribute(
    'href',
    'https://github.com/lq200lq/atrium-os',
  )
})

test('顶栏 视图 → 显示桌面：菜单项拨动桌面速览开关', async ({ page }) => {
  await gotoShell(page)
  const toggle = page.getByRole('button', { name: '显示桌面' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')

  await page.getByRole('button', { name: '视图' }).click()
  await page.getByRole('menuitem', { name: '显示桌面' }).click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')

  // 再开菜单：勾选态进入文案（MenuItem 无 checked 位，用 ✓ 前缀表达）
  await page.getByRole('button', { name: '视图' }).click()
  await expect(page.getByRole('menuitem', { name: /✓ 显示桌面/ })).toBeVisible()
})
