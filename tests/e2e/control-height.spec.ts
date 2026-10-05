import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * S8 尺寸契约验收：三档控件的**实测高度**必须等于 --control-height-* 的刻度值。
 * 单测只能断言类名（happy-dom 不加载 Tailwind 产物），像素一致性在此完成。
 */
const STEPS = [
  { cls: 'h-control-sm', token: '--control-height-sm', px: 24 },
  { cls: 'h-control', token: '--control-height-md', px: 28 },
  { cls: 'h-control-lg', token: '--control-height-lg', px: 32 },
] as const

const scaleOf = (page: Page) =>
  page.evaluate(
    (names) =>
      Object.fromEntries(
        names.map((n) => [
          n,
          parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)),
        ]),
      ) as Record<string, number>,
    STEPS.map((s) => s.token),
  )

async function openConventions(page: Page): Promise<Locator> {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible()
  await page.locator('nav button[title="组件陈列"]').click()
  const win = page.locator('section').filter({ hasText: '组件陈列' })
  await expect(win.getByText('通用约定')).toBeVisible()
  // 开窗动画给窗口体套了 scale，落定后 rect 高度才等于布局高度
  await expect
    .poll(() => win.evaluate((el) => getComputedStyle(el).transform))
    .toMatch(/none|matrix\(1,\s*0,\s*0,\s*1,\s*0(,\s*0)?\)/)
  return win
}

function measure(locator: Locator) {
  return locator.evaluateAll((els) =>
    els.map((el) => ({
      computed: getComputedStyle(el).height,
      rect: el.getBoundingClientRect().height,
    })),
  )
}

test('三档刻度变量解析为 24 / 28 / 32', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible()
  expect(await scaleOf(page)).toEqual({
    '--control-height-sm': 24,
    '--control-height-md': 28,
    '--control-height-lg': 32,
  })
})

test('同一档位下 Button / Input / Select 的计算高度与实测高度都等于刻度', async ({ page }) => {
  const win = await openConventions(page)
  const scale = await scaleOf(page)

  for (const step of STEPS) {
    const box = win.locator(`.${step.cls}`)
    // 每一档都至少铺开按钮、输入、选择三类控件
    expect(await box.count(), `${step.cls} 控件数量`).toBeGreaterThanOrEqual(3)
    for (const m of await measure(box)) {
      expect(m.computed, `${step.cls} 计算高度`).toBe(`${step.px}px`)
      expect(m.rect, `${step.cls} 实测高度`).toBeCloseTo(scale[step.token], 0)
    }
    expect(scale[step.token], `${step.token} 刻度值`).toBe(step.px)
  }
})

test('loading 与 disabled 不改变控件高度', async ({ page }) => {
  const win = await openConventions(page)
  const md = await measure(win.locator('button.h-control'))
  // md 档按钮同时呈现常态 / 禁用 / 加载三种，高度不应出现漂移
  expect(md.length, 'md 档按钮数量').toBeGreaterThanOrEqual(3)
  expect(new Set(md.map((m) => m.computed)), '计算高度唯一').toEqual(new Set(['28px']))
  const rects = md.map((m) => m.rect)
  expect(Math.max(...rects) - Math.min(...rects), '实测高度漂移').toBeLessThan(1)
})
