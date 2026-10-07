import { expect, test, type Page } from '@playwright/test'

/**
 * S7 焦点可见性验收：键盘焦点必须落在 token 环上（main.css 的 :focus-visible 基线），
 * 且基线规则确实随构建产物发布；鼠标点击不产生键盘环（:focus-visible 语义）。
 */
interface FocusRing {
  tag: string
  style: string
  width: number
  color: string
}

function readRing(page: Page): Promise<FocusRing | null> {
  return page.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body) return null
    const cs = getComputedStyle(el)
    return {
      tag: el.tagName,
      style: cs.outlineStyle,
      width: parseFloat(cs.outlineWidth) || 0,
      color: cs.outlineColor,
    }
  })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  // 等壳层挂载完再按 Tab，否则焦点会落在仍是 body 的文档上
  await expect(page.getByRole('banner')).toBeVisible()
})

test('键盘 Tab 落点有 token 焦点环', async ({ page }) => {
  await page.keyboard.press('Tab')
  const ring = await readRing(page)
  expect(ring, '应有获得焦点的元素').not.toBeNull()
  expect(ring!.style).not.toBe('none')
  expect(ring!.width).toBeGreaterThanOrEqual(2)
  // 环色来自强调色派生层，不是浏览器默认黑
  expect(ring!.color).not.toBe('rgb(0, 0, 0)')
})

test('Spotlight 输入框键盘可达且焦点环可见', async ({ page }) => {
  await page.keyboard.press('Control+k')
  await expect(page.locator('input:focus')).toHaveCount(1)
  const ring = await readRing(page)
  expect(ring!.tag).toBe('INPUT')
  expect(ring!.style).not.toBe('none')
  expect(ring!.width).toBeGreaterThanOrEqual(2)
})

test('鼠标点击不套键盘焦点环', async ({ page }) => {
  await page.locator('nav button').first().click()
  const ring = await readRing(page)
  // 要么没有环（:focus-visible 未激活），要么宽度为 0
  expect(ring === null || ring.style === 'none' || ring.width === 0).toBe(true)
})

test('焦点基线规则随样式表发布', async ({ page }) => {
  const found = await page.evaluate(() => {
    // Tailwind 把基线规则放在 @layer base 里，需要递归进分组规则。
    // 选择器按精确值认，不按「第一条含 :focus-visible 的规则」认——工具类（如某个件里的
    // `focus-visible:opacity-100`）会编译成 `.focus-visible\:opacity-100:focus-visible`，
    // 排在基线之前，靠顺序判就会把「基线没发布」和「有人多写了一个变体」混成同一个红。
    const walk = (rules: CSSRuleList): string | null => {
      for (const rule of Array.from(rules)) {
        const style = rule as CSSStyleRule
        if (style.selectorText?.trim() === ':focus-visible') return style.cssText
        const group = rule as CSSGroupingRule
        if (group.cssRules?.length) {
          const nested = walk(group.cssRules)
          if (nested) return nested
        }
      }
      return null
    }
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const hit = walk(sheet.cssRules)
        if (hit) return hit
      } catch {
        // 跨域样式表读不到 cssRules，跳过
      }
    }
    return null
  })
  expect(found, 'main.css 的 :focus-visible 基线应出现在样式表里').not.toBeNull()
  expect(found).toContain('outline')
})
