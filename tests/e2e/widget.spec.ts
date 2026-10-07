import { expect, test, type Page } from '@playwright/test'
import { dockTile, gotoShell } from './helpers'

/**
 * 桌面小组件：首启种子、从小组件库增删、落库后刷新仍在、层级在窗口之下。
 * 桌面右键点选在壁纸空白处（左侧标语与右侧小组件 band 之外），确保命中 Desktop 的右键处理器。
 */
const frameOf = (kind: string) => `[data-widget-kind="${kind}"]`

async function openGallery(page: Page) {
  await page.mouse.click(320, 620, { button: 'right' })
  await page.getByRole('button', { name: '添加小组件' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

test('首启铺上内置小组件，且右锚定贴桌面右内边距', async ({ page }) => {
  await gotoShell(page)

  await expect(page.locator(frameOf('clock'))).toHaveCount(1)
  await expect(page.locator(frameOf('calendar'))).toHaveCount(1)
  await expect(page.locator(frameOf('todos'))).toHaveCount(1)

  const width = page.viewportSize()!.width
  const box = await page.locator(frameOf('clock')).boundingBox()
  expect(box).toBeTruthy()
  // 时钟是 md（344 宽），右缘贴 24px 内边距
  expect(Math.round(box!.width)).toBe(344)
  expect(Math.round(box!.x + box!.width)).toBe(width - 24)
})

test('小组件层在窗口层之下（z-desktop < 窗口 z）', async ({ page }) => {
  await gotoShell(page)

  const layerZ = await page
    .locator('[data-widget-layer]')
    .evaluate((el) => Number(getComputedStyle(el).zIndex))
  expect(layerZ).toBe(5)

  await page.locator(dockTile('文件管理')).click()
  const win = page.locator('section').filter({ hasText: '文件管理' })
  await expect(win).toBeVisible()
  const winZ = await win.evaluate((el) => Number(getComputedStyle(el).zIndex))

  expect(winZ).toBeGreaterThan(layerZ)
})

test('交互型小组件能收到点击：件内控件吃掉点击，卡片不把它当成一次下钻', async ({ page }) => {
  await gotoShell(page)
  // 桌面上的待办是 md 且真实数据为空（样例只活在预览沙箱里），所以先从小组件库放一张 lg：
  // lg 才有底部就地添加的输入框，也才有可点的勾选框
  await openGallery(page)
  const row = page.locator('[data-widget-kind-row="todos"]')
  await row.getByRole('button', { name: '添加', exact: true }).click()
  await row.locator('[data-widget-size-chooser]').getByRole('radio', { name: '大' }).click()
  await row.getByRole('button', { name: '确定' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  const card = page.locator(frameOf('todos')).filter({ has: page.locator('input[type="text"]') })
  await expect(card).toHaveCount(1)

  const input = card.locator('input[type="text"]')
  await input.fill('验收点击的待办')
  await input.press('Enter')
  const item = card.locator('li').filter({ hasText: '验收点击的待办' })
  await expect(item).toHaveCount(1)
  const progress = card.getByText(/^完成 \d+\/\d+$/)
  await expect(progress).toHaveText('完成 0/1')
  const windows = await page.locator('section.absolute').count()

  // 勾选落在件内：主结论随之改写（默认不显示已完成，行随即消失），
  // 但这次点击既没启动拖拽、也没被当成整块下钻去开应用窗口
  await item.getByRole('checkbox').click()
  await expect(progress).toHaveText('完成 1/1')
  await expect(item).toHaveCount(0)
  expect(await page.locator('section.absolute').count()).toBe(windows)

  await page.waitForTimeout(600) // 数据写走 300ms 防抖
  await page.reload()
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(progress).toHaveText('完成 1/1')
})

test('小组件层不挡桌面：卡片间隙右键仍弹桌面菜单', async ({ page }) => {
  await gotoShell(page)

  // 层是 pointer-events-none，只有卡片自己恢复指针事件——间隙应落到桌面
  await page.mouse.click(40, 700, { button: 'right' })
  await expect(page.getByRole('button', { name: '添加小组件' })).toBeVisible()
})

test('小组件本体右键弹卡片菜单：尺寸就地生效、管理项带着这张卡进中心', async ({ page }) => {
  await gotoShell(page)

  const clock = page.locator(frameOf('clock'))
  const menu = page.locator('[data-shell-menu]')

  await clock.click({ button: 'right' })
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('button')).toHaveText([
    '小',
    '中',
    '大',
    '配置',
    '立即刷新',
    '管理小组件…',
    '移除',
  ])
  // 当前档（md）左侧出勾
  await expect(menu.getByRole('button', { name: '中', exact: true }).locator('svg')).toHaveCount(1)

  // 点「小」就地换尺寸：卡片立刻变成 160 宽，菜单收起
  await menu.getByRole('button', { name: '小', exact: true }).click()
  await expect(menu).toHaveCount(0)
  await expect.poll(async () => Math.round((await clock.boundingBox())!.width)).toBe(160)

  // 「管理小组件…」把实例 id 交给管理面，中心窗口里就是这一行展开并滚到视线（§4.5）
  const instanceId = await clock.getAttribute('data-widget-id')
  expect(instanceId).toBeTruthy()
  await clock.click({ button: 'right' })
  await menu.getByRole('button', { name: '管理小组件…', exact: true }).click()
  const win = page.locator('section.absolute').filter({ hasText: '桌面上的小组件' })
  await expect(win).toBeVisible()
  await expect(
    win.locator(`[data-widget-instance-row="${instanceId}"] [data-widget-config-panel]`),
  ).toBeVisible()
})

test('小组件中心：停用/启用就地生效，卸载连带摘实例，装回货架要自己再添加', async ({ page }) => {
  await gotoShell(page)
  await page.locator(dockTile('小组件中心')).click()

  const win = page.locator('section.absolute').filter({ hasText: '桌面上的小组件' })
  await expect(win).toBeVisible()
  const catalog = win.locator('[data-widget-section="catalog"]')
  const onDesk = win.locator('[data-widget-section="on-desktop"]')
  const clockRow = catalog.locator('[data-widget-kind-row="clock"]')

  // 生命周期收进目录行的「⋯」（§4.8 合一视图）。停用时钟：桌面卡片消失，
  // 但实例与配置仍在台账里（行内标「已禁用」）
  await clockRow.getByRole('button', { name: '操作' }).click()
  await clockRow.getByRole('menuitem', { name: '停用' }).click()
  await expect(page.locator(frameOf('clock'))).toHaveCount(0)
  await expect(
    onDesk.locator('[data-widget-instance-row]').filter({ hasText: '时钟' }),
  ).toContainText('已禁用')

  await clockRow.getByRole('button', { name: '操作' }).click()
  await clockRow.getByRole('menuitem', { name: '启用' }).click()
  await expect(page.locator(frameOf('clock'))).toHaveCount(1)

  // 卸载月历：不可逆到需要一次确认，实例连带从台账摘掉
  const calendarRow = catalog.locator('[data-widget-kind-row="calendar"]')
  await calendarRow.getByRole('button', { name: '操作' }).click()
  await calendarRow.getByRole('menuitem', { name: '卸载' }).click()
  await page.getByRole('button', { name: '确定' }).click()
  await expect(page.locator(frameOf('calendar'))).toHaveCount(0)
  await expect(onDesk.locator('[data-widget-instance-row]')).toHaveCount(2)

  // 装回来只回到货架：实例不复活，得自己再从「添加」放上桌面
  await calendarRow.getByRole('button', { name: '操作' }).click()
  await calendarRow.getByRole('menuitem', { name: '安装' }).click()
  await expect(page.locator(frameOf('calendar'))).toHaveCount(0)
  await calendarRow.getByRole('button', { name: '操作' }).click()
  await expect(calendarRow.getByRole('menuitem', { name: '卸载' })).toBeEnabled()
  await calendarRow.getByRole('button', { name: '操作' }).click()

  await calendarRow.getByRole('button', { name: '添加', exact: true }).click()
  await expect(calendarRow.getByRole('button', { name: '确定' })).toBeVisible()
  await calendarRow.getByRole('button', { name: '确定' }).click()
  await expect(page.locator(frameOf('calendar'))).toHaveCount(1)

  await page.waitForTimeout(600)
  await page.reload()
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.locator(frameOf('clock'))).toHaveCount(1)
  await expect(page.locator(frameOf('calendar'))).toHaveCount(1)
})

test('从小组件库按尺寸添加，落库后刷新仍在', async ({ page }) => {
  await gotoShell(page)
  await openGallery(page)

  const row = page.locator('[data-widget-kind-row="clock"]')
  // 尺寸不在行上常驻，而在「添加」弹出的选档层里（A-4：一种件一行，不是一档一行）
  await row.getByRole('button', { name: '添加', exact: true }).click()
  await row
    .locator('[data-widget-size-chooser]')
    .getByRole('radio', { name: '小', exact: true })
    .click()
  await row.getByRole('button', { name: '确定' }).click()

  await expect(page.locator(frameOf('clock'))).toHaveCount(2)
  const widths = await page
    .locator(frameOf('clock'))
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().width)))
  expect(widths).toContain(160) // sm = 2 格

  await page.waitForTimeout(600) // 等 debounce 之外的异步落库
  await page.reload()
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.locator(frameOf('clock'))).toHaveCount(2)
})

test('移除小组件后落库，刷新不复活且不影响其它件', async ({ page }) => {
  await gotoShell(page)

  const frame = page.locator(frameOf('todos'))
  // 卡片表面没有 hover 浮标了：移除从右键菜单走（2026-10-07）
  await frame.click({ button: 'right' })
  await page.getByRole('button', { name: '移除' }).click()
  await page.getByRole('button', { name: '确定' }).click()
  await expect(page.locator(frameOf('todos'))).toHaveCount(0)

  await page.waitForTimeout(600)
  await page.reload()
  await expect(page.getByRole('banner')).toBeVisible()

  await expect(page.locator(frameOf('todos'))).toHaveCount(0) // 清空过就不再补种
  await expect(page.locator(frameOf('clock'))).toHaveCount(1)
  await expect(page.locator(frameOf('calendar'))).toHaveCount(1)
})

/**
 * 标语让位（E18）。原判据是「占用 ≥2 个 band」，它只在宽带下成立：窄窗口解出的网格只剩
 * 一个 band，摆放域却已经横切进左侧标语上方，band 数仍是 1 ⇒ 大字标语被卡片压住一半。
 * 两条腿一起钉住修正后的口径：≥2 band **或** 与摆放域真实相交才淡出，且不许过度让位
 * （宽带下一个 band 与标语互不相干时，标语必须还在——否则这条装饰就凭空消失了）。
 */
test.describe('标语让位（E18：band 数 + 相交兜底）', () => {
  test('窄窗口只剩一个 band，但摆放域压到标语上方：标语淡出', async ({ page }) => {
    await page.setViewportSize({ width: 560, height: 800 })
    await gotoShell(page)
    // 前提：件确实上了桌面（band 0 的左缘已越到标语盒子之内）
    const clock = page.locator(frameOf('clock'))
    await expect(clock).toHaveCount(1)
    const [slogan, card] = await Promise.all([
      page.locator('[data-desktop-slogan]').boundingBox(),
      clock.boundingBox(),
    ])
    expect(slogan && card && card.x < slogan.x + slogan.width).toBe(true)
    await expect(page.locator('[data-desktop-slogan]')).toHaveClass(/opacity-0/)
  })

  test('宽窗口一个 band 与标语不相交：标语照常常驻', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await gotoShell(page)
    const clock = page.locator(frameOf('clock'))
    await expect(clock).toHaveCount(1)
    const [slogan, card] = await Promise.all([
      page.locator('[data-desktop-slogan]').boundingBox(),
      clock.boundingBox(),
    ])
    expect(slogan && card && card.x >= slogan.x + slogan.width).toBe(true)
    await expect(page.locator('[data-desktop-slogan]')).toHaveClass(/opacity-100/)
  })
})
