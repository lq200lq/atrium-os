import { expect, test, type Page } from '@playwright/test'
import { dockTile, gotoShell } from './helpers'

// 外部网页应用（embed 类目）的端到端门禁：决策 D2′ 说「iframe 只能作为这类应用的内容区」，
// 那么「用户添加的站点真的在窗口里渲染出来了没有」就只能由 frame 内部的文本来证明——
// 只看 iframe 元素存在会放过一整类失败（被 X-Frame-Options 拒了也是一样的空壳）。

const FIXTURE = '/embed-demo.html'
const FIXTURE_NAME = '本地夹具'

test.beforeEach(async ({ page }) => {
  await gotoShell(page)
})

/** 应用中心 → 「网页应用」分区 */
async function webAppsSection(page: Page) {
  await page.locator(dockTile('应用中心')).click()
  const win = page.locator('section.absolute').filter({ has: page.locator('[role="radiogroup"]') })
  await expect(win).toBeVisible()
  await win.locator('[role="radio"]', { hasText: '网页应用' }).click()
  return win
}

async function addWebApp(page: Page, name: string, url: string) {
  const win = await webAppsSection(page)
  await win.getByRole('button', { name: '添加网页应用' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.locator('input').nth(0).fill(name)
  await dialog.locator('input').nth(1).fill(url)
  await dialog.getByRole('button', { name: '确定' }).click()
  await expect(dialog).toHaveCount(0)
  return win
}

const webWindow = (page: Page) =>
  page.locator('section.absolute').filter({ has: page.locator('iframe') })

test('网页应用：添加后 Dock 出磁贴，窗口里 iframe 真的渲染出同源内容', async ({ page }) => {
  const win = await addWebApp(page, FIXTURE_NAME, `http://localhost:5199${FIXTURE}`)
  await expect(win.getByText(FIXTURE_NAME)).toBeVisible()
  await expect(win.getByText('共 1 个')).toBeVisible()
  await expect(win.getByText(`http://localhost:5199${FIXTURE}`)).toBeVisible()

  await page.locator(dockTile(FIXTURE_NAME)).click()
  await expect(webWindow(page)).toBeVisible()
  await expect(page.frameLocator(`iframe[src$="${FIXTURE}"]`).locator('#fixture-title')).toHaveText(
    '嵌入内容渲染成功',
  )
})

test('网页应用：刷新后应用与窗口布局都在，内容仍渲染', async ({ page }) => {
  await addWebApp(page, FIXTURE_NAME, `http://localhost:5199${FIXTURE}`)
  await page.locator(dockTile(FIXTURE_NAME)).click()
  await expect(webWindow(page)).toBeVisible()

  // 布局是防抖写 IDB 的，立刻刷新会丢掉最后一条记录
  await page.waitForTimeout(600)
  await page.reload()

  await expect(page.locator(dockTile(FIXTURE_NAME))).toBeVisible()
  await expect(webWindow(page)).toBeVisible()
  await expect(page.frameLocator(`iframe[src$="${FIXTURE}"]`).locator('#fixture-title')).toHaveText(
    '嵌入内容渲染成功',
  )
})

test('网页应用：卸载连带关窗删磁贴，再刷新不复活', async ({ page }) => {
  await addWebApp(page, FIXTURE_NAME, `http://localhost:5199${FIXTURE}`)
  await page.locator(dockTile(FIXTURE_NAME)).click()
  await expect(webWindow(page)).toBeVisible()
  await page.waitForTimeout(600)

  const win = await webAppsSection(page)
  await win.getByRole('button', { name: '卸载' }).click()
  const confirm = page.getByRole('dialog')
  await expect(confirm).toContainText(`卸载「${FIXTURE_NAME}」`)
  await confirm.getByRole('button', { name: '卸载' }).click()
  await expect(confirm).toHaveCount(0)

  // 注册表摘掉而窗口还活着的话，内容区会渲染成空白壳——所以这里必须数到 0
  await expect(webWindow(page)).toHaveCount(0)
  await expect(page.locator(dockTile(FIXTURE_NAME))).toHaveCount(0)
  await expect(win.getByText('共 0 个')).toBeVisible()

  await page.waitForTimeout(600)
  await page.reload()
  await expect(page.locator(dockTile(FIXTURE_NAME))).toHaveCount(0)
  await expect(page.locator('iframe')).toHaveCount(0)
})

test('网页应用：javascript: 地址被字段错误拦下，不入库也不开窗', async ({ page }) => {
  const win = await webAppsSection(page)
  await win.getByRole('button', { name: '添加网页应用' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('input').nth(0).fill('陷阱')
  await dialog.locator('input').nth(1).fill('javascript:alert(1)')
  await dialog.getByRole('button', { name: '确定' }).click()

  // 精确到字段错误那一行：弹窗底部的常驻提示也以同样的话开头
  await expect(dialog.locator('p.text-danger-text')).toHaveText('只支持 http/https 地址')
  // 弹窗没关就是没入库；列表仍为空，Dock 也没有多出第 9 个磁贴
  await expect(win.getByText('共 0 个')).toBeVisible()
  await expect(page.locator(dockTile('陷阱'))).toHaveCount(0)
})

test('内置文档中心：embed 类目样板渲染同源文档站首页', async ({ page }) => {
  await page.locator(dockTile('文档中心')).click()
  const win = webWindow(page)
  await expect(win).toBeVisible()
  await expect(
    page.frameLocator('iframe[src="/docs/index.html"]').getByText('企业级 Vue 3 前端脚手架'),
  ).toBeVisible()
})

test('访客角色不收窄 embed 类目：受限内置应用照旧隐藏，公开的两类仍在', async ({ page }) => {
  // S2 的权限模型只管内置应用的准入，用户添加的站点 permissions 为空即公开。
  // 这条断言的存在意义是防「新增类目顺手要求授权」：那样访客会连自己加的站点都打不开。
  await addWebApp(page, FIXTURE_NAME, `http://localhost:5199${FIXTURE}`)

  await page.locator(dockTile('设置')).click()
  const settings = page.locator('section.absolute').filter({ hasText: '用户与角色' })
  await settings.locator('button', { hasText: '访客' }).click()
  // 角色真的切了才谈得上「没被收窄」——受限应用消失就是这枚哨兵
  await expect(page.locator(dockTile('文件管理'))).toHaveCount(0)

  await expect(page.locator(dockTile('文档中心'))).toBeVisible()
  await expect(page.locator(dockTile(FIXTURE_NAME))).toBeVisible()

  await page.locator(dockTile(FIXTURE_NAME)).click()
  await expect(webWindow(page)).toBeVisible()
  await expect(page.frameLocator(`iframe[src$="${FIXTURE}"]`).locator('#fixture-title')).toHaveText(
    '嵌入内容渲染成功',
  )
})
