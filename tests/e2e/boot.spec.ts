import { expect, test } from '@playwright/test'

/**
 * 首屏启动态（index.html 内联）：
 * - 入口模块未落地 → 启动 spinner 可见（拦掉 entry.ts 复现空窗）；
 * - mount('#app') 清空容器 → 启动屏必须消失，否则固定定位的遮罩会挡住整个桌面。
 * 无 JS 的 <noscript> 覆盖态无法用 Playwright 选择器断言（其引擎不进 noscript 子树），
 * 以像素核验收尾：底色 #e6f0f9 + 文案、无 spinner 蓝、无白底——见 index.html 注释。
 */

test('入口未落地时显示启动 spinner', async ({ page }) => {
  await page.route('**/src/entry.ts', (r) => r.abort())
  await page.goto('/')
  await expect(page.locator('.boot-spinner')).toBeVisible()
})

test('mount 后启动屏消失，不遮挡桌面交互', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.locator('.boot-screen')).toHaveCount(0)
})
