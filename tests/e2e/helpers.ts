import { expect, type Page } from '@playwright/test'

// 按主题拆分后的 e2e spec 共享的定位/装配助手。
// 仓库规则「同类信息收敛一处」：新 spec 一律从这里导入，不再各自复制。

/** Dock 磁贴（按钮以 title 属性标注应用名） */
export const dockTile = (name: string) => `nav button[title="${name}"]`

/**
 * 冷启动进入壳层（各 spec 文件在 beforeEach 中调用）。
 * 就绪屏障是必要的：Vite 的模块图在 load 事件之后才完成挂载，`src/entry.ts` 还要再动态导入
 * `main.ts`（反嵌套守卫的代价），而它先 await 第一波 IndexedDB restore，所以 `goto()` 返回时
 * ⌘K 之类的全局监听可能尚未注册。
 * 不等就直接按键会偶发抢跑（a11y 的 Spotlight 场景就是这么红的）。等顶栏出现即可，
 * 它是挂载完成的确定信号，且不会放松任何后续断言。
 */
export async function gotoShell(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible()
}

/** 应用中心 → 「网页应用」分区（返回该分区所在的窗口，供列表断言复用） */
export async function webAppsSection(page: Page) {
  await page.locator(dockTile('应用中心')).click()
  const win = page.locator('section.absolute').filter({ has: page.locator('[role="radiogroup"]') })
  await expect(win).toBeVisible()
  await win.locator('[role="radio"]', { hasText: '网页应用' }).click()
  return win
}

/** 走 UI 添加一个网页应用：这是用户添加外部站点的唯一入口，测试不为任何类目开特权 */
export async function addWebApp(page: Page, name: string, url: string) {
  const win = await webAppsSection(page)
  await win.getByRole('button', { name: '添加网页应用' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.locator('input').nth(0).fill(name)
  await dialog.locator('input').nth(1).fill(url)
  await dialog.getByRole('button', { name: '确定' }).click()
  await expect(dialog).toHaveCount(0)
  return win
}

/** 内容区装着 iframe 的那个窗口（embed 类目由内核合成 EmbedView，故 iframe 只出现在这里） */
export const webWindow = (page: Page) =>
  page.locator('section.absolute').filter({ has: page.locator('iframe') })
