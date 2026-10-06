import { expect, test, type Page } from '@playwright/test'
import { dockTile, gotoShell } from './helpers'

// 文档站深链的运行链门禁（决策 D2′）：中间件只做「真文件存在才重写 req.url」，于是它的成败只能由
// 「这个 URL 最终 serve 出的是文档站，还是 WebOS 自己的壳」来证明——只看 iframe 元素存在会放过整类失败。
// 正向断言刻意用 VitePress 的结构类（.VPHome / .VPDoc）而不是正文文案：文档内容天天改，结构类不牵连。
// html[data-webos-guard] 计数为 0 是配套的反向锁（守卫写这个属性之后）：拦住「退回套壳也算通过」。

/**
 * 首页里由 VitePress 自己生成的三种形态（cleanUrls: true 下站内不存在带 .html 的内链，实测过）：
 * logo 走 normalizeLink('/') 落目录根，nav 的分区落带尾斜杠的目录根，其余叶子页一律无扩展名。
 * 这三类都不在 Vite 的 sirv（extensions: []）与 htmlFallback（只看项目根）的命中范围内。
 */
const DIRECTORY_ROOT = '/docs/'
const SECTION_ROOT = '/docs/components/'
const EXTENSIONLESS = '/docs/tokens'

const DOCS_FRAME = 'iframe[src="/docs/index.html"]'

/** 打开内置文档中心窗口，返回它内容区的 frame（同源，可直接下钻） */
async function openDocsCenter(page: Page) {
  await gotoShell(page)
  await page.locator(dockTile('文档中心')).click()
  const frame = page.locator(DOCS_FRAME).contentFrame()
  await expect(frame.locator('.VPHome')).toBeVisible()
  return frame
}

test('文档中心首开：iframe 里是文档站首页，不是被 SPA fallback 套进来的壳', async ({ page }) => {
  const frame = await openDocsCenter(page)
  // .VPHome 只可能来自 VitePress 的首页模板：壳层自己的产物里没有这个类，所以在场即为正向证据
  await expect(frame.locator('.VPHome')).toBeVisible()
  await expect(frame.locator('html[data-webos-guard]')).toHaveCount(0)
})

test('文档站内链盘点：目录根 / 尾斜杠分区 / 无扩展名叶子三种形态都真在链接集合里', async ({
  page,
}) => {
  const frame = await openDocsCenter(page)
  const hrefs = await frame
    .locator('a[href^="/docs"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''))

  expect(hrefs).toContain(DIRECTORY_ROOT)
  expect(hrefs).toContain(SECTION_ROOT)
  expect(hrefs).toContain(EXTENSIONLESS)
})

test('文档站搜索确实生效：frame 内有触发件，且中文站不留英文默认文案', async ({ page }) => {
  const frame = await openDocsCenter(page)
  // VitePress 只在 search.provider='local' 时渲染这件，所以这条锁的是「配了且真的装上了」
  const trigger = frame.locator('.VPNavBarSearch button')
  await expect(trigger).toBeVisible()
  // buttonText 同时驱动触发件文案与弹窗 placeholder：不配 translations 这里就是 "Search"
  await expect(trigger).toContainText('搜索文档')
})

for (const [label, path] of [
  ['目录根（logo 形态）', DIRECTORY_ROOT],
  ['带尾斜杠的分区（nav 形态）', SECTION_ROOT],
  ['无扩展名叶子页', EXTENSIONLESS],
] as const) {
  test(`文档站硬导航 ${label}：${path} 落在真页面`, async ({ page }) => {
    // 直接 goto 就是「frame 里 Ctrl/中键开新标签」与「地址栏输入」这两类硬导航的服务端形态：
    // 会话内点链接走的是 VitePress 自己的 SPA 路由，压根不发这个请求，测不到重写。
    await page.goto(path)
    await expect(page.locator('.VPHome, .VPDoc').first()).toBeVisible()
    // 标题是第二枚正向锁：壳层是「万物皆应用 · WebOS」，文档站一律带「WebOS 脚手架」
    await expect(page).toHaveTitle(/WebOS 脚手架/)
    await expect(page.locator('html[data-webos-guard]')).toHaveCount(0)
  })
}
