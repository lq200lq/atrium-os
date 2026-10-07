import { expect, test, type Page } from '@playwright/test'
import { addWebApp, dockTile, gotoShell, webWindow } from './helpers'

// 文档站深链的运行链门禁（决策 D2′）：中间件只做「真文件存在才重写 req.url」，于是它的成败只能由
// 「这个 URL 最终 serve 出的是文档站，还是 Atrium OS 自己的壳」来证明——只看 iframe 元素存在会放过整类失败。
// 正向断言刻意用 VitePress 的结构类（.VPHome / .VPDoc）而不是正文文案：文档内容天天改，结构类不牵连。
// html[data-atrium-guard] 计数为 0 是配套的反向锁（守卫写这个属性之后）：拦住「退回套壳也算通过」。

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
  await expect(frame.locator('html[data-atrium-guard]')).toHaveCount(0)
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
    // 标题是第二枚正向锁：壳层是「万物皆应用 · Atrium OS」，文档站一律带「Atrium OS 脚手架」
    await expect(page).toHaveTitle(/Atrium OS 脚手架/)
    await expect(page.locator('html[data-atrium-guard]')).toHaveCount(0)
  })
}

// 守卫两态：前两层都失手时，第三层必须说实话。用应用中心添加站点走这条链（而不是给测试开壳层特权），
// 是因为「被嵌的到底是谁」只有从 embed 类目本身的渲染路径才证得出来。
const MISSING_DOCS_PAGE = '/docs/no-such-page'
const SITE_ROOT = '/'

test('守卫 docs-fallback 态：文档站缺页时降级页给可执行处方，且是有样式的页而不是裸文本', async ({
  page,
}) => {
  await gotoShell(page)
  await addWebApp(page, '缺页文档', `http://localhost:5199${MISSING_DOCS_PAGE}`)
  await page.locator(dockTile('缺页文档')).click()

  const frame = page.locator(`iframe[src$="${MISSING_DOCS_PAGE}"]`).contentFrame()
  const card = frame.locator('#embed-guard[data-atrium-guard="docs-fallback"]')
  await expect(card).toBeVisible()
  await expect(frame.locator('html[data-atrium-guard="docs-fallback"]')).toHaveCount(1)
  await expect(card.locator('p[lang="zh-CN"]')).toContainText('npm run docs:embed')
  // 双语并列两个 lang 段落：此刻 i18n 还没启动，只能靠 lang 属性把两种语言同时摊开
  await expect(card.locator('p[lang="en"]')).toBeVisible()
  // 样式的最小证据：卡片有边框。旧守卫只写 textContent，那条路径下这条必红。
  await expect(card).not.toHaveCSS('borderTopWidth', '0px')
  // 套壳的反向锁：降级页里不该有 Dock
  await expect(frame.locator('nav')).toHaveCount(0)
})

test('守卫 self-embed 态：把本站根路径当同源入口是用法错误，不该顺带教人跑构建命令', async ({
  page,
}) => {
  await gotoShell(page)
  await addWebApp(page, '本站根路径', `http://localhost:5199${SITE_ROOT}`)
  await page.locator(dockTile('本站根路径')).click()

  const frame = page.locator('iframe[src="http://localhost:5199/"]').contentFrame()
  const card = frame.locator('#embed-guard[data-atrium-guard="self-embed"]')
  await expect(card).toBeVisible()
  const zh = (await card.locator('p[lang="zh-CN"]').textContent()) ?? ''
  expect(zh).toContain('/docs/index.html')
  // 两种成因各给各的处方：混进一句话会把「能用」的假希望塞给用法错误
  expect(zh).not.toContain('docs:embed')
  await expect(frame.locator('nav')).toHaveCount(0)
})

test('被嵌入的实例零副作用：守卫文档不写 layout-v1，外层布局不被内层旧快照盖掉', async ({
  page,
}) => {
  // 记账脚本在每个文档（含稍后的 iframe）里独立执行：谁往 kv 写 layout-v1 在谁的 window 上记一笔。
  // 为什么断「谁写的」而不是「reload 后少没少窗口」：内层的防抖与外层的防抖谁后落盘是时序竞赛，
  // 输赢取决于模块图加载耗时；而「被嵌入的那份文档一次都不该写」是无条件的不变量——
  // 它红了就一定是守卫被挪回了启动之后。
  await page.addInitScript(() => {
    const counter = { writes: 0 }
    Object.defineProperty(window, '__layoutWrites', { value: counter, configurable: true })
    const proto = IDBObjectStore.prototype
    const put = proto.put
    proto.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (this.name === 'kv' && key === 'layout-v1') counter.writes += 1
      return put.call(this, value, key)
    }
  })

  await gotoShell(page)
  await addWebApp(page, '本站根路径', `http://localhost:5199${SITE_ROOT}`)

  // 前置条件：内层得先恢复出一套**非空**布局，才谈得上「把旧快照写回去」。全新上下文里 layout-v1 是空的，
  // 内层的 restoreLayout 会原样早退、一次都不写——那样的绿是假的。所以先开一扇窗口并等防抖落盘（>400ms）。
  const settings = page.locator('section.absolute').filter({ hasText: '用户与角色' })
  await page.locator(dockTile('设置')).click()
  await expect(settings).toBeVisible()
  await page.waitForTimeout(700)

  await page.locator(dockTile('本站根路径')).click()
  const embedFrame = page.locator('iframe[src="http://localhost:5199/"]').contentFrame()
  // 等到守卫渲染：在「守卫挪回启动链尾」的旧形态里，这一刻内层的 restoreLayout 刚跑完、防抖正在计时，
  // 紧接着外层这笔改动就是会被内层旧快照盖掉的那一笔。
  await expect(embedFrame.locator('#embed-guard')).toBeVisible()

  // 外层紧接着的一笔布局改动：再开一扇看板窗（点 Dock 磁贴恒可点，不去和叠在上面的窗口抢坐标）
  await page.locator(dockTile('数据看板')).click()
  const board = page.locator('section.absolute').filter({ hasText: '统计概览' })
  await expect(board).toBeVisible()

  // 两轮 400ms 防抖：内层若真启动过，写入必然已经发生
  await page.waitForTimeout(1500)
  const innerWrites = await embedFrame.locator('#embed-guard').evaluate((el) => {
    const view = el.ownerDocument.defaultView as unknown as { __layoutWrites?: { writes: number } }
    return view?.__layoutWrites?.writes ?? -1
  })
  expect(innerWrites, '被嵌入的实例写了布局，说明它跑过了 store 启动').toBe(0)

  // 可读的那一面：这笔开窗活到了刷新之后（内层若跑过，它写回的是自己那份没有看板的旧快照）
  await page.reload()
  await expect(board).toBeVisible()
  await expect(webWindow(page)).toBeVisible()
})
