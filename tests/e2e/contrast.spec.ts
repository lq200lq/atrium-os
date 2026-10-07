import { expect, test, type Page } from '@playwright/test'

/**
 * S7 色彩派生验收：五个语义（accent/success/warning/danger/info）的
 * 「浅底 bg + 深字 text」组合，在明暗两套主题 × 四套强调色预设下都必须
 * 达到 WCAG AA 正文对比度（4.5:1）。派生公式只有一处，所以这里测的是公式本身。
 */
const SEMANTICS = ['accent', 'success', 'warning', 'danger', 'info'] as const
const MODES = ['light', 'dark'] as const
const ACCENTS = ['sky', 'violet', 'emerald', 'rose'] as const

/** color-mix / oklab / lch 等现代色函数需归一到 sRGB 通道才能算对比度，用 canvas 解析 */
async function readCss(page: Page, pairs: { fg: string; bg: string }[]) {
  return page.evaluate((list) => {
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
    return list.map(({ fg, bg }) => {
      const [f, b] = [over(rgb(fg)), over(rgb(bg))]
      const [l1, l2] = [lum(f), lum(b)]
      return {
        pair: `${fg} ↔ ${bg}`,
        fg: f.css,
        bg: b.css,
        ratio: Number(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2)),
      }
    })
  }, pairs)
}

function readPair(page: Page, sem: string) {
  return readCss(page, [{ fg: `--color-${sem}-text`, bg: `--color-${sem}-bg` }]).then((r) => r[0])
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
          const { ratio, bg, fg } = await readPair(page, sem)
          expect(
            ratio,
            `${mode}/${accent} ${sem}（bg ${bg} ↔ text ${fg}）应达 AA`,
          ).toBeGreaterThanOrEqual(4.5)
        }
      })
    }
  }
})

/**
 * S12 axe 盲区补位：S7 只测过「语义色浅底 + 深字」五组配对，没覆盖中性文本三级
 * ink-mute（caption 正文级）与实底控件前景 on-accent。axe 预跑正是这两处
 * serious/critical（#94a3b8 白底 2.56、白字 on #0ea5e9 2.77）。这里按 token 公式
 * 直测派生结果——明暗 × 四预设下都必须 ≥ AA 正文 4.5:1。
 */
const NEUTRAL_PAIRS = [
  { fg: '--color-ink-mute', bg: '--color-surface' },
  { fg: '--color-ink-mute', bg: '--color-surface-sunken' },
  { fg: '--color-ink-mute', bg: '--color-surface-hover' },
  { fg: '--color-ink-mute', bg: '--color-accent-bg' },
  { fg: '--color-ink-mute', bg: '--color-fill' },
  { fg: '--color-on-accent', bg: '--color-accent' },
  // S13 实填主按钮：深一档 accent-fill 底 + 白字（--raw-mix-lighten 明暗两主题都是 #fff）
  { fg: '--raw-mix-lighten', bg: '--color-accent-fill' },
]

test.describe('中性文本与实底前景对比度（S12 axe 盲区）', () => {
  for (const mode of MODES) {
    for (const accent of ACCENTS) {
      test(`${mode} × ${accent}：ink-mute 各级表面 + on-accent 实底 ≥ 4.5:1`, async ({ page }) => {
        await page.goto('/')
        await expect(page.getByRole('banner')).toBeVisible()
        await page.evaluate(
          ([m, a]) => {
            document.documentElement.dataset.theme = m
            document.documentElement.dataset.accent = a
          },
          [mode, accent] as const,
        )
        for (const result of await readCss(page, NEUTRAL_PAIRS)) {
          expect(
            result.ratio,
            `${mode}/${accent} ${result.pair}（fg ${result.fg} ↔ bg ${result.bg}）应达 AA`,
          ).toBeGreaterThanOrEqual(4.5)
        }
      })
    }
  }
})
