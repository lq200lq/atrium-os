import { expect, test, type Page } from '@playwright/test'
import { dockTile, gotoShell } from './helpers'

/**
 * 磁贴图标对比度门禁。
 *
 * OsAppTile 统一「加深渐变 + 白色线图标」；磁贴背景是 background-image（渐变），
 * axe 的 color-contrast 规则会直接跳过，所以这里读计算样式自测：白图标对**每个渐变端点**
 * 都要 ≥ 4.5:1（AA 正文级，严于 WCAG 非文本 3:1 地板——取端点当保守界，且不依赖具体 palette 值）。
 */

interface Tile {
  name: string
  fg: number[]
  stops: number[][]
}

const COLOR_FN = /(?:rgba?|oklch|oklab|lab|lch|hsla?|color)\([^()]*\)/g

/** 读页面内全部 [data-app-tile]：图标色 + 渐变各端点（经 canvas 归一到 sRGB） */
async function readTiles(page: Page): Promise<Tile[]> {
  return page.evaluate((colorFn: string): Tile[] => {
    const ctx = new OffscreenCanvas(1, 1).getContext('2d')!
    const resolve = (css: string): number[] => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = '#000'
      ctx.fillStyle = css
      ctx.fillRect(0, 0, 1, 1)
      const d = ctx.getImageData(0, 0, 1, 1).data
      return [d[0] / 255, d[1] / 255, d[2] / 255]
    }
    const re = new RegExp(colorFn, 'g')
    return [...document.querySelectorAll('[data-app-tile]')].map((el) => {
      const cs = getComputedStyle(el)
      const btn = el.closest('button')
      return {
        name: btn?.getAttribute('title') || btn?.textContent?.trim() || '(磁贴)',
        fg: resolve(cs.color),
        stops: (cs.backgroundImage.match(re) ?? []).map(resolve),
      }
    })
  }, COLOR_FN.source)
}

const lum = (c: number[]) => {
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}
const contrast = (a: number[]) => {
  const l1 = lum(a)
  return (c: number[]) => {
    const l2 = lum(c)
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
    return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2))
  }
}

function assertReadable(tiles: Tile[]) {
  expect(tiles.length, '应有可读表面').toBeGreaterThan(0)
  for (const t of tiles) {
    expect(
      t.stops.length,
      `${t.name}：渐变实底应读出各端点（background-image）`,
    ).toBeGreaterThanOrEqual(2)
    const vs = contrast(t.fg)
    for (const stop of t.stops) {
      expect(
        vs(stop),
        `${t.name}：白前景对渐变端点应 ≥ 4.5:1（AA 正文级，严于非文本 3:1 地板）`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  }
}

test('Dock 磁贴：白图标对 tint 渐变各端点 ≥ 4.5:1', async ({ page }) => {
  await gotoShell(page)
  assertReadable(await readTiles(page))
})

test('应用中心磁贴：白图标对 tint 渐变各端点 ≥ 4.5:1', async ({ page }) => {
  await gotoShell(page)
  await page.locator(dockTile('应用中心')).click()
  await expect(page.locator('input[placeholder="搜索应用…"]')).toBeVisible()
  assertReadable(await readTiles(page))
})

/**
 * 小组件库抽屉里每个种类行的「添加」钮用 `kind.tint` 做渐变实底 + 白字白图标（`OsButton` 的 tint
 * 分支），和磁贴是同一块表面、同一条地板。件的 tint 是 manifest 里的字面量，没有类型兜着——
 * 浅色相（amber）在 600 档就只有 3.2:1，这里逐行量。
 */
async function readAddButtons(page: Page): Promise<Tile[]> {
  return page.evaluate((colorFn: string): Tile[] => {
    const ctx = new OffscreenCanvas(1, 1).getContext('2d')!
    const resolve = (css: string): number[] => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = '#000'
      ctx.fillStyle = css
      ctx.fillRect(0, 0, 1, 1)
      const d = ctx.getImageData(0, 0, 1, 1).data
      return [d[0] / 255, d[1] / 255, d[2] / 255]
    }
    const re = new RegExp(colorFn, 'g')
    return [...document.querySelectorAll('[data-widget-kind-row]')].map((row) => {
      // 陈列卡里预览可能带件内 button，取按钮认 data-widget-add 钩子而不是「第一个 button」
      const btn = row.querySelector('[data-widget-add]')!
      const cs = getComputedStyle(btn)
      return {
        name: `${row.getAttribute('data-widget-kind-row')} 添加钮`,
        fg: resolve(cs.color),
        stops: (cs.backgroundImage.match(re) ?? []).map(resolve),
      }
    })
  }, COLOR_FN.source)
}

test('小组件库抽屉：种类行添加钮的 tint 实底 ≥ 4.5:1', async ({ page }) => {
  await gotoShell(page)
  await page.mouse.click(320, 620, { button: 'right' })
  await page.getByRole('button', { name: '添加小组件' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const buttons = await readAddButtons(page)
  expect(buttons.length, '抽屉里应有种类行可读').toBeGreaterThan(0)
  assertReadable(buttons)
})
