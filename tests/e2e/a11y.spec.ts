import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { dockTile, gotoShell } from './helpers'

// S12 接入：axe 门禁默认执行（独立 CI job `a11y` 也单跑）。
// 本地排障：`A11Y_DEBUG=1 npx playwright test a11y` 打印违规节点明细。

/**
 * 已知 serious/critical 违规基线，按场景登记为 `规则id × 节点数`。
 * 只减不增：出现新条目即失败；条目消失但不删同样失败（防止基线虚胖）。
 * S12 源码修复后目标态为空（0 个 serious/critical）。
 */
const BASELINE: Record<string, string[]> = {}

async function scan(page: Page, scenario: string): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const hit = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  if (process.env.A11Y_DEBUG) {
    for (const v of hit) {
      console.error(`[${scenario}] ${v.id} (${v.impact}) — ${v.help}`)
      for (const n of v.nodes) {
        console.error(`  target: ${JSON.stringify(n.target)}\n  ${n.failureSummary}`)
        console.error(`  html: ${n.html?.slice(0, 200)}`)
      }
    }
  }
  return hit.map((v) => `${v.id} × ${v.nodes.length}`).sort()
}

/** 与 BASELINE 对照：新违规与失效条目都要显式处理 */
function expectClean(scenario: string, found: string[]) {
  const allowed = BASELINE[scenario] ?? []
  const unexpected = found.filter((f) => !allowed.includes(f))
  const stale = allowed.filter((a) => !found.includes(a))
  expect(
    unexpected,
    `${scenario}：出现新的 axe serious/critical 违规（可跑 \`A11Y_DEBUG=1 npx playwright test a11y\` 看节点）`,
  ).toEqual([])
  expect(stale, `${scenario}：基线条目已不再复现，请从 BASELINE 删除`).toEqual([])
}

test('壳层冷启动：顶栏/Dock/桌面无可判定违规', async ({ page }) => {
  await gotoShell(page)
  expectClean('shell', await scan(page, 'shell'))
})

test('Spotlight 浮层：输入框与结果列表', async ({ page }) => {
  await gotoShell(page)
  await page.keyboard.press('Control+k')
  await expect(page.locator('input[placeholder="搜索应用与文件…"]')).toBeVisible()
  expectClean('spotlight', await scan(page, 'spotlight'))
})

test('组件陈列：逐页签扫描全量组件', async ({ page }) => {
  await gotoShell(page)
  await page.locator(dockTile('组件陈列')).click()
  const win = page.locator('section.absolute').filter({ has: page.locator('[role="tablist"]') })
  await expect(win).toBeVisible()

  const labels = await win.locator('[role="tab"]').allTextContents()
  expect(labels.length).toBeGreaterThan(0)
  // 逐页签收集后统一断言：首个页签失败不掩盖后续页签的问题
  const dirty: Record<string, string[]> = {}
  for (const label of labels) {
    const tab = label.trim()
    await win.locator('[role="tab"]').filter({ hasText: tab }).click()
    const found = await scan(page, `gallery:${tab}`)
    if (found.length) dirty[tab] = found
  }
  expect(dirty, '组件陈列存在 axe serious/critical 违规的页签').toEqual({})
  for (const tab of labels.map((l) => l.trim())) {
    expectClean(`gallery:${tab}`, [])
  }
})

test('设置窗口：角色切换与诊断区块', async ({ page }) => {
  await gotoShell(page)
  await page.locator(dockTile('设置')).click()
  const win = page.locator('section.absolute').filter({ hasText: '用户与角色' })
  await expect(win).toBeVisible()
  expectClean('settings', await scan(page, 'settings'))
})

/**
 * S12 降级验收：main.css 的 prefers-reduced-motion 规则把时长压到 --duration-reduced
 * 并取消入场位移，但**状态切换本身必须照常发生**——Vue 的 Transition 靠 transitionend
 * 判定动画结束，时长归零写法若让它收不到结束事件，窗口就会卡在过渡态。
 */
test.describe('prefers-reduced-motion 降级', () => {
  test.use({ reducedMotion: 'reduce' })

  test('窗口开启与关闭仍然完成，且过渡时长降到下限', async ({ page }) => {
    await gotoShell(page)
    await page.locator(dockTile('文件管理')).click()
    const win = page.locator('section').filter({ hasText: '文件管理' })
    await expect(win, '降级下窗口照样能开').toBeVisible()

    const duration = await win.evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration))
    expect(duration, '过渡时长应被压到 ~0（秒）').toBeLessThanOrEqual(0.001)

    await win.locator('header button[title="关闭"]').click()
    await expect(win, '降级下窗口照样能关').toHaveCount(0)
  })
})
