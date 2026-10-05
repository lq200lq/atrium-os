import { expect, test } from '@playwright/test'

/**
 * S7 窗口级响应式验收：自适应单位是**窗口**而不是视口（tokens.css 的 cq-window +
 * w-narrow/w-mid/w-wide）。这里把窗口体压到窄档，验证应用内布局真的换行铺满。
 */
test('窗口压窄到 w-narrow 时，数据看板筛选条换行铺满', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible()
  await page.locator('nav button[title="数据看板"]').click()

  const body = page.locator('.cq-window').first()
  await expect(body).toBeVisible()
  const search = body.locator('div.w-44')
  const select = body.locator('div.w-32')

  const wideSearch = await search.boundingBox()
  const wideSelect = await select.boundingBox()
  expect(wideSearch && wideSelect).toBeTruthy()
  // 宽窗口：两个筛选控件同排，且搜索框保持档宽而非铺满
  expect(Math.abs(wideSearch!.y - wideSelect!.y)).toBeLessThan(2)
  expect(wideSearch!.width).toBeLessThan(200)

  await body.evaluate((el) => {
    el.style.width = '360px'
  })
  await expect
    .poll(async () => (await search.boundingBox())?.width ?? 0, {
      message: '窄窗口下搜索框应铺满容器',
    })
    .toBeGreaterThan(300)

  const narrowSearch = await search.boundingBox()
  const narrowSelect = await select.boundingBox()
  // 换行：选择器落到搜索框之下
  expect(narrowSelect!.y).toBeGreaterThan(narrowSearch!.y + narrowSearch!.height - 2)
})
