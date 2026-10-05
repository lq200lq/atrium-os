import { expect, test, type Page } from '@playwright/test'

/**
 * S7 色彩派生验收：五个语义（accent/success/warning/danger/info）的
 * 「浅底 bg + 深字 text」组合，在明暗两套主题 × 四套强调色预设下都必须
 * 达到 WCAG AA 正文对比度（4.5:1）。派生公式只有一处，所以这里测的是公式本身。
 */
const SEMANTICS = ['accent', 'success', 'warning', 'danger', 'info'] as const
const MODES = ['light', 'dark'] as const
const ACCENTS = ['sky', 'violet', 'emerald', 'rose'] as const

/** color-mix / oklab 等现代色函数需归一到 sRGB 通道才能算对比度，用 canvas 解析 */
async function readPair(page: Page, sem: string) {
  return page.evaluate((s) => {
    const cs = getComputedStyle(document.documentElement)
    const rgb = (varName: string) => {
      const value = cs.getPropertyValue(varName).trim()
      const ctx = new OffscreenCanvas(1, 1).getContext('2d')!
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = value
      ctx.fillRect(0, 0, 1, 1)
      const d = ctx.getImageData(0, 0, 1, 1).data
      return { r: d[0] / 255, g: d[1] / 255, b: d[2] / 255, a: d[3] / 255, css: value }
    }
    const lum = (c: { r: number; g: number; b: number }) => {
      const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
    }
    // bg 带 alpha 时先叠到当前主题表面色上（暗色主题的混合基色是透明，需实算）
    const surface = rgb('--color-surface')
    const over = (fg: ReturnType<typeof rgb>) =>
      fg.a >= 1
        ? fg
        : {
            r: fg.r * fg.a + surface.r * (1 - fg.a),
            g: fg.g * fg.a + surface.g * (1 - fg.a),
            b: fg.b * fg.a + surface.b * (1 - fg.a),
            a: 1,
            css: fg.css,
          }
    const bg = over(rgb(`--color-${s}-bg`))
    const text = over(rgb(`--color-${s}-text`))
    const [l1, l2] = [lum(bg), lum(text)]
    return {
      bg: bg.css,
      text: text.css,
      ratio: Number(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2)),
    }
  }, sem)
}

test.describe('语义色对比度（WCAG AA）', () => {
  for (const mode of MODES) {
    for (const accent of ACCENTS) {
      test(`${mode} × ${accent}：五语义浅底深字 ≥ 4.5:1`, async ({ page }) => {
        await page.goto('/')
        await expect(page.getByRole('banner')).toBeVisible()
        await page.evaluate(
          ([m, a]) => {
            document.documentElement.dataset.theme = m
            document.documentElement.dataset.accent = a
          },
          [mode, accent] as const,
        )
        for (const sem of SEMANTICS) {
          const { ratio, bg, text } = await readPair(page, sem)
          expect(
            ratio,
            `${mode}/${accent} ${sem}（bg ${bg} ↔ text ${text}）应达 AA`,
          ).toBeGreaterThanOrEqual(4.5)
        }
      })
    }
  }
})
