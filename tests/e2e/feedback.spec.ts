import { expect, test, type Page } from '@playwright/test'

const dockTile = (name: string) => `nav button[title="${name}"]`

/** 吐司由 OsToast 直接 Teleport 到 body，故只取 body 直属节点：窗口内还有 OsAlert/OsResult 同用 role=status */
const showToast = (page: Page, role: 'status' | 'alert') => page.locator(`body > [role="${role}"]`)

async function openGalleryFeedback(page: Page) {
  await page.locator(dockTile('组件陈列')).click()
  const win = page.locator('section.absolute').filter({ has: page.locator('[role="tablist"]') })
  await win.getByRole('tab', { name: '反馈' }).click()
  return win
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('命令式 notify：等级同时决定吐司 aria role，并写进同一份通知队列', async ({ page }) => {
  const win = await openGalleryFeedback(page)

  // 四个入口按钮以方法名命名，吐司文案才是 locale 里的通知标题
  await win.getByRole('button', { name: 'success', exact: true }).click()
  await expect(showToast(page, 'status')).toContainText('已保存')

  // 点掉吐司再发下一条：同一时刻只呈现最新一条，避免撞上自动收起的时序
  await showToast(page, 'status').click()
  await expect(showToast(page, 'status')).toHaveCount(0)

  await win.getByRole('button', { name: 'error', exact: true }).click()
  await expect(showToast(page, 'alert')).toContainText('同步失败')

  await page.locator('header button.relative').click()
  const panel = page.locator('aside.fixed')
  await expect(panel.locator('li').first()).toContainText('同步失败')
  await expect(panel.locator('li').filter({ hasText: '已保存' })).toHaveCount(1)
})

test('命令式 confirm：取消不执行任何动作，确认后才回写 success', async ({ page }) => {
  const win = await openGalleryFeedback(page)
  await win.locator('button', { hasText: '发起确认' }).click()
  await expect(page.getByText('确认执行这个演示操作？')).toBeVisible()

  // 对话框由 FeedbackHost 渲染在壳层末尾，取消/确定取 DOM 里最后出现的这组
  await page.locator('button', { hasText: '取消' }).last().click()
  await expect(showToast(page, 'status')).toContainText('你点了取消')

  await win.locator('button', { hasText: '发起确认' }).click()
  await page.locator('button', { hasText: '确定' }).last().click()
  await expect(showToast(page, 'status')).toContainText('你点了确定')
})

test('文件管理删除先过确认：取消保住文件，确认才移入回收站', async ({ page }) => {
  await page.locator(dockTile('文件管理')).click()
  const win = page.locator('section.absolute').filter({ hasText: '修改时间' })
  await expect(win.locator('tbody tr').first()).toBeVisible()
  const rowName = (await win.locator('tbody tr').first().innerText()).split('\n')[0]!.trim()

  await win.locator('tbody tr').first().locator('input[type="checkbox"]').check()
  await win.locator('button', { hasText: '删除' }).click()
  await expect(page.getByText('确定要将')).toBeVisible()

  await page.locator('button', { hasText: '取消' }).last().click()
  await expect(win.locator('tbody tr').first()).toContainText(rowName)

  await win.locator('tbody tr').first().locator('input[type="checkbox"]').check()
  await win.locator('button', { hasText: '删除' }).click()
  await page.locator('button', { hasText: '移入回收站' }).last().click()
  await expect(showToast(page, 'status')).toContainText('已移入回收站')
  // 目录树里的回收站节点带条数，删除后计数出现（缺省 fixture 可能已有条目，不断言具体数字）
  await expect(win.locator('aside').getByText(/^回收站（\d+）$/)).toBeVisible()
})

test('设置诊断块：OsAlert 计数 + OsTag 分级 + 空态 OsResult 都在真实渲染里成立', async ({
  page,
}) => {
  const win = await openGalleryFeedback(page)
  await win.getByRole('button', { name: 'error', exact: true }).click()
  // 制造一条崩溃留痕，让日志列表非空
  await win.getByRole('button', { name: '模拟应用崩溃' }).click()
  await expect(page.getByText('应用出错了')).toBeVisible()

  await page.locator(dockTile('设置')).click()
  const settings = page.locator('section.absolute').filter({ hasText: '用户与角色' })
  const diag = settings.locator('section').filter({ hasText: '诊断日志' })
  await expect(diag).toBeVisible()
  // OsAlert：说明区随条数变化
  await expect(diag.getByText(/本会话留痕 \d+ 条/)).toBeVisible()
  // OsTag：作用域标签由组件出 tint，不再是手写 bg-danger/15 chip
  await expect(diag.getByText('窗口', { exact: true })).toBeVisible()

  await diag.locator('button', { hasText: '清空日志' }).click()
  await expect(diag.getByText('运行正常')).toBeVisible()
  await expect(diag.getByText('本会话留痕 0 条')).toBeVisible()
})

test('403 落地：结果态给出「去设置」出口并能打开设置窗口', async ({ page }) => {
  const win = await openGalleryFeedback(page)
  await win.locator('[role="radio"]', { hasText: '无访问权限' }).click()

  const result = win.getByRole('status').filter({ hasText: '无访问权限' })
  await expect(result).toContainText('当前角色缺少该应用所需权限')

  await result.locator('button', { hasText: '去设置' }).click()
  await expect(page.locator('section.absolute').filter({ hasText: '用户与角色' })).toBeVisible()
})
