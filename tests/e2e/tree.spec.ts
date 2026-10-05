import { expect, test } from '@playwright/test'

/**
 * S9 验收：file-manager 目录树改由 OsTree 承载（role=tree/treeitem + aria-expanded），
 * 展开文件夹并选择子目录要能驱动右侧列表导航，行为与旧侧栏一致。
 */
test('文件管理目录树：展开「我的文件」并选择子目录', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible()
  await page.locator('nav button[title="文件管理"]').click()

  const win = page.locator('section.absolute').filter({ hasText: '文件管理' })
  const tree = win.getByRole('tree')
  await expect(tree).toBeVisible()

  const home = win.getByRole('treeitem', { name: '我的文件' })
  await expect(home).toHaveAttribute('aria-expanded', 'false')
  await home.locator('[data-tree-toggle]').click()
  await expect(home).toHaveAttribute('aria-expanded', 'true')

  const product = win.getByRole('treeitem', { name: '产品方案' })
  await expect(product).toBeVisible()
  await expect(product).toHaveAttribute('aria-level', '2')
  await product.click()
  await expect(product).toHaveAttribute('aria-selected', 'true')

  await expect(win.locator('nav button').filter({ hasText: '产品方案' })).toBeVisible()
  await expect(win.getByText('此目录为空')).toBeVisible()
})

/**
 * 键盘导航只有真实焦点与布局才能验（happy-dom 拿不到 roving tabindex 的落焦效果）：
 * → 展开、↓ 移到子级、Enter 选中，且整个树只占一个 tab 停靠点。
 */
test('文件管理目录树：方向键展开/移动并回车选中', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible()
  await page.locator('nav button[title="文件管理"]').click()

  const win = page.locator('section.absolute').filter({ hasText: '文件管理' })
  const tree = win.getByRole('tree')
  const home = win.getByRole('treeitem', { name: '我的文件' })

  await home.focus()
  await expect(home).toBeFocused()
  expect(await tree.locator('[tabindex="0"]').count()).toBe(1)

  await page.keyboard.press('ArrowRight')
  await expect(home).toHaveAttribute('aria-expanded', 'true')

  await page.keyboard.press('ArrowDown')
  const firstChild = win.getByRole('treeitem').nth(1)
  await expect(firstChild).toBeFocused()

  await page.keyboard.press('Enter')
  await expect(firstChild).toHaveAttribute('aria-selected', 'true')

  await page.keyboard.press('ArrowLeft')
  await expect(home).toBeFocused()
  await expect(home).toHaveAttribute('aria-expanded', 'true')

  await page.keyboard.press('ArrowLeft')
  await expect(home).toHaveAttribute('aria-expanded', 'false')
})
