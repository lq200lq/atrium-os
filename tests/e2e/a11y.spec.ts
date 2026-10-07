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
  // axe 读的是即时计算样式：入场/离场动画没跑完时，半透明的玻璃层（窗口、抽屉、吐司）会把背景混淡，
  // 对比度读数随之漂移（settings 与小组件库都撞过 4.x:1 的偶发失败）。等所有过渡类撤下再扫。
  await page.waitForFunction(
    () => !document.querySelector('[class*="-enter-active"], [class*="-leave-active"]'),
    null,
    { timeout: 5000 },
  )
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

test('小组件库抽屉：实例配置与种类列表', async ({ page }) => {
  await gotoShell(page)
  await page.mouse.click(320, 620, { button: 'right' })
  await page.getByRole('button', { name: '添加小组件' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expectClean('widget-gallery', await scan(page, 'widget-gallery'))
})

test('小组件中心窗口：种类台账与实例两段', async ({ page }) => {
  await gotoShell(page)
  await page.locator(dockTile('小组件中心')).click()
  // 窗口本身是 section.absolute：面板内的分区也是 section，按 absolute 收窄到窗口
  await expect(page.locator('section.absolute').filter({ hasText: '桌面上的小组件' })).toBeVisible()
  expectClean('widget-center', await scan(page, 'widget-center'))
})

test('小组件卡片右键菜单：玻璃弹层与条目', async ({ page }) => {
  await gotoShell(page)
  await page.locator('[data-widget-kind="clock"]').click({ button: 'right' })
  await expect(page.locator('[data-shell-menu]')).toBeVisible()
  expectClean('widget-menu', await scan(page, 'widget-menu'))
})

test('小组件卡片配置弹层：schema 字段与页脚按钮', async ({ page }) => {
  await gotoShell(page)
  // 配置面此前从未进过 axe 的视野：抽屉那条只开到收起态的实例行，面板要「管理小组件…」定位才展开。
  // 取待办是因为它在桌面种子里、面板走 schema 缺省渲染（时钟那张是 `configEntry` 自绘），
  // 而 boolean 字段渲染出的 `OsSwitch` 是四类控件里此前唯一没传可访问名的那一个（另三类一直传）。
  await page.locator('[data-widget-kind="todos"]').click({ button: 'right' })
  await page.locator('[data-shell-menu]').getByRole('button', { name: '配置', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '今日待办 配置' })).toBeVisible()
  expectClean('widget-config', await scan(page, 'widget-config'))
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
 * 网页应用扫描面刻意只到「管理面板 + embed 窗口 chrome + 同源夹具」三处。
 * axe 会下钻同源 iframe，所以这里不能改成扫「文档中心」窗口：那等于把 VitePress 自有页面的
 * 问题记在壳层门禁头上——文档站的可访问性该由文档站自己修。
 */
test('网页应用：管理面板、添加弹窗与 embed 窗口', async ({ page }) => {
  await gotoShell(page)
  await page.locator(dockTile('应用中心')).click()
  const win = page.locator('section.absolute').filter({ has: page.locator('[role="radiogroup"]') })
  await win.locator('[role="radio"]', { hasText: '网页应用' }).click()
  expectClean('web-apps-panel', await scan(page, 'web-apps-panel'))

  await win.getByRole('button', { name: '添加网页应用' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  expectClean('web-app-dialog', await scan(page, 'web-app-dialog'))

  await dialog.locator('input').nth(0).fill('夹具站')
  await dialog.locator('input').nth(1).fill('http://localhost:5199/embed-demo.html')
  await dialog.getByRole('button', { name: '确定' }).click()
  await expect(dialog).toHaveCount(0)

  await page.locator(dockTile('夹具站')).click()
  await expect(
    page.frameLocator('iframe[src$="/embed-demo.html"]').locator('#fixture-title'),
  ).toHaveText('嵌入内容渲染成功')
  expectClean('embed-window', await scan(page, 'embed-window'))
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
