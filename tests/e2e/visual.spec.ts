import { expect, test, type Page } from '@playwright/test'
import { dockTile, gotoShell } from './helpers'

/**
 * S12 视觉回归基线：组件级截图 diff，守住 token/结构漂移（「AI 感」类问题的机器版）。
 *
 * 维护方式：
 * - 生成/更新：`npx playwright test visual --update-snapshots`，然后必须肉眼看过新基线再提交。
 * - 基线按平台分目录（`…-snapshots/<platform>/`）：字体栅格化跨 OS 不可比，mac 基线守护本地，
 *   CI 在 ubuntu 上比对 linux 基线（首次由 CI 环境跑一次 --update-snapshots 后提交）。
 * - 三处钉死不确定项：时钟冻结（顶栏/日历/vfs 种子）、reducedMotion、animations:'disabled'。
 */

const FROZEN_TIME = new Date('2026-10-05T09:30:00')

test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

/** 冻结时钟后再导航：顶栏时钟、Widgets 日历与 vfs 时间戳全部落在同一个时点 */
async function frozenShell(page: Page) {
  await page.clock.setFixedTime(FROZEN_TIME)
  await gotoShell(page)
  await expect(page.getByRole('banner')).toBeVisible()
}

async function setTheme(page: Page, mode: 'dark') {
  await page.evaluate((m) => {
    document.documentElement.dataset.theme = m
  }, mode)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
}

/** 打开组件陈列窗口并切到指定页签，返回窗口元素（含标题栏与页签栏） */
async function galleryTab(page: Page, tab: string) {
  await frozenShell(page)
  await page.locator(dockTile('组件陈列')).click()
  const win = page.locator('section.absolute').filter({ has: page.locator('[role="tablist"]') })
  await expect(win).toBeVisible()
  await win.locator('[role="tab"]').filter({ hasText: tab }).click()
  // 等页签内容真的换掉：窗口内出现该页签的第一个分组标题
  await expect(win.locator('h3').first()).toBeVisible()
  return win
}

test('壳层桌面（浅色）：顶栏 + Widgets + Dock', async ({ page }) => {
  await frozenShell(page)
  await expect(page).toHaveScreenshot('shell-light.png')
})

test('壳层桌面（暗色）：token 反色与玻璃层', async ({ page }) => {
  await frozenShell(page)
  await setTheme(page, 'dark')
  await expect(page).toHaveScreenshot('shell-dark.png')
})

test('Spotlight 浮层：输入框与结果列表', async ({ page }) => {
  await frozenShell(page)
  await page.locator('header button', { hasText: '⌘K' }).click()
  await expect(page.locator('input[placeholder="搜索应用与文件…"]')).toBeVisible()
  await expect(page).toHaveScreenshot('spotlight.png')
})

/** 页签 → 基线文件名（ASCII，避免中文文件名在 CI/git 上的编码风险） */
const TABS = [
  ['基础', 'basic'],
  ['录入', 'input'],
  ['布局', 'layout'],
  ['展示', 'display'],
  ['导航', 'nav'],
  ['反馈', 'feedback'],
  ['作用域配置', 'config'],
] as const

for (const [tab, slug] of TABS) {
  test(`组件陈列窗口：${tab} 页签`, async ({ page }) => {
    const win = await galleryTab(page, tab)
    await expect(win).toHaveScreenshot(`gallery-${slug}.png`)
  })
}
