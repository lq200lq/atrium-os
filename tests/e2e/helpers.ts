import { expect, type Page } from '@playwright/test'

// 按主题拆分后的 e2e spec 共享的定位/装配助手。
// 仓库规则「同类信息收敛一处」：新 spec 一律从这里导入，不再各自复制。

/** Dock 磁贴（按钮以 title 属性标注应用名） */
export const dockTile = (name: string) => `nav button[title="${name}"]`

/**
 * 冷启动进入壳层（各 spec 文件在 beforeEach 中调用）。
 * 就绪屏障是必要的：Vite 的模块图在 load 事件之后才完成挂载，而 `main.ts` 还要先 await
 * 第一波 IndexedDB restore，所以 `goto()` 返回时 ⌘K 之类的全局监听可能尚未注册。
 * 不等就直接按键会偶发抢跑（a11y 的 Spotlight 场景就是这么红的）。等顶栏出现即可，
 * 它是挂载完成的确定信号，且不会放松任何后续断言。
 */
export async function gotoShell(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible()
}
