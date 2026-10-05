import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * S11 作用域配置验收：OsConfigProvider 的尺寸 / 强调色 / 内建文案语言只作用于自己的子树。
 * 单测只能断言类名与 CSS 变量（happy-dom 不加载 Tailwind 产物、也算不出 color-mix），
 * 「作用域内 vs 作用域外」两处的实测高度与 computed 背景色必须在真实浏览器里量。
 */
const dockTile = (name: string) => `nav button[title="${name}"]`

/** 作用域内 = Provider 根（.os-config）所在分组；作用域外 = 不包 Provider 的对照分组 */
const insideGroup = (win: Locator) => win.getByRole('group', { name: '作用域内' })
const outsideGroup = (win: Locator) => win.getByRole('group', { name: '作用域外' })

/** OsSegmented 的段是 role=radio，按可见 label 点档 */
const segment = (win: Locator, label: string) =>
  win.getByRole('radio', { name: label, exact: true })

const primaryButton = (group: Locator) => group.getByRole('button', { name: '主要', exact: true })

/** 实测高度与 computed 背景色：两处的差异就是「作用域生效」的证据（scale 动画已在前置里落定） */
const rectHeight = (locator: Locator) => locator.evaluate((el) => el.getBoundingClientRect().height)
const bgColor = (locator: Locator) => locator.evaluate((el) => getComputedStyle(el).backgroundColor)

async function openScopeTab(page: Page): Promise<Locator> {
  const win = page.locator('section.absolute').filter({ has: page.locator('[role="tablist"]') })
  // 刷新后陈列窗由布局快照自动还原，此时再点 Dock 命中的是「最小化」语义，所以只在没有可见窗口时开窗
  if ((await win.count()) === 0 || !(await win.first().isVisible())) {
    await page.locator(dockTile('组件陈列')).click()
  }
  await win.getByRole('tab', { name: '作用域配置' }).click()
  // 开窗动画给窗口体套了 scale，落定后 rect 高度才等于布局高度（同 control-height.spec）
  await expect
    .poll(() => win.evaluate((el) => getComputedStyle(el).transform))
    .toMatch(/none|matrix\(1,\s*0,\s*0,\s*1,\s*0(,\s*0)?\)/)
  return win
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('作用域尺寸与强调色只改子树：内 24 / 外 28，内背景随预设变、外不变', async ({ page }) => {
  const win = await openScopeTab(page)
  const inside = primaryButton(insideGroup(win))
  const outside = primaryButton(outsideGroup(win))

  // 默认「跟随作用域外」：两侧都是 md 档，实测高度必然相等——差异必须来自作用域而不是初始状态
  await expect(inside).toHaveCSS('height', '28px')
  expect(await rectHeight(inside)).toBeCloseTo(await rectHeight(outside), 0)

  // 作用域的 --control-height-sm 只落在 .os-config 上，子树就近取到 24
  await segment(win, 'sm').click()
  await expect(inside).toHaveCSS('height', '24px')
  expect(await rectHeight(inside), '作用域内走 sm 刻度').toBeCloseTo(24, 0)
  expect(await rectHeight(outside), '作用域外仍是 md 刻度').toBeCloseTo(28, 0)

  // 切回不覆盖：高度差立刻消失（作用域是响应式的，不是渲染一次就定死）
  await segment(win, '跟随作用域外').click()
  await expect(inside).toHaveCSS('height', '28px')

  // 强调色：作用域只换子树里的 seed，六级派生与对照区都不受影响
  const accentBefore = await bgColor(outside)
  await segment(win, '紫罗兰').click()
  await expect(inside).not.toHaveCSS('background-color', accentBefore)
  expect(await bgColor(inside), '子树内 --color-accent 就近重算').not.toBe(accentBefore)
  expect(await bgColor(outside), '子树外仍是全局强调色').toBe(accentBefore)
  // 全局设置没被改写：根元素上的预设仍是 sky
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'sky')
})

test('作用域语言只改组件内建文案：内英外中，应用文案与壳层不变', async ({ page }) => {
  const win = await openScopeTab(page)
  const inside = insideGroup(win)
  const outside = outsideGroup(win)

  await expect(inside.getByText('暂无数据')).toBeVisible()
  await segment(win, 'English').click()

  // 内建文案（common.empty / common.selectPlaceholder / pagination.total）随作用域语言
  await expect(inside.getByText('No data')).toBeVisible()
  await expect(inside.locator('option').first()).toHaveText('Select…')
  await expect(inside.getByText('45 in total')).toBeVisible()
  // 对照区三处仍是中文
  await expect(outside.getByText('暂无数据')).toBeVisible()
  await expect(outside.locator('option').first()).toHaveText('请选择')
  await expect(outside.getByText('共 45 条')).toBeVisible()

  // 应用内容文案不受作用域影响，只跟着全局 i18n
  await expect(primaryButton(inside)).toHaveText('主要')
  await expect(page.getByRole('banner').getByText('万物皆应用')).toBeVisible()
})

test('刷新不残留：三档取值回默认，全局主题与语言都没被带跑', async ({ page }) => {
  const win = await openScopeTab(page)
  await segment(win, 'lg').click()
  await segment(win, '玫瑰红').click()
  await segment(win, 'English').click()
  const inside = primaryButton(insideGroup(win))
  // 先等响应式落定（属性 / 计算样式是自动重試的），再取实测值做数值断言
  await expect(win.locator('.os-config')).toHaveAttribute('data-accent', 'rose')
  await expect(inside).toHaveCSS('height', '32px')
  expect(await rectHeight(inside), '作用域内走 lg 刻度').toBeCloseTo(32, 0)
  expect(await bgColor(inside)).not.toBe(await bgColor(primaryButton(outsideGroup(win))))

  await page.reload()
  const reopened = await openScopeTab(page)

  // 作用域控件回到三个「不覆盖」默认档
  for (const label of ['跟随作用域外', '不覆盖', '跟随全局']) {
    await expect(segment(reopened, label)).toHaveAttribute('aria-checked', 'true')
  }
  // 内建文案与高度都退回全局：内外的实测高度再次相等
  await expect(insideGroup(reopened).getByText('暂无数据')).toBeVisible()
  await expect(primaryButton(insideGroup(reopened))).toHaveCSS('height', '28px')
  expect(await rectHeight(primaryButton(insideGroup(reopened)))).toBeCloseTo(
    await rectHeight(primaryButton(outsideGroup(reopened))),
    0,
  )
  // 壳层文案与全局预设/语言均未因作用域操作而改变（Provider 从不写 store）
  await expect(page.getByRole('banner').getByText('万物皆应用')).toBeVisible()
  await expect(page.getByRole('banner').getByText('搜索应用、文件、知识…')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'sky')
})
