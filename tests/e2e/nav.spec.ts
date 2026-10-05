import { expect, test } from '@playwright/test'

const dockTile = (name: string) => `nav button[title="${name}"]`

/** 打开组件陈列并切到「导航」页签，返回窗口定位器 */
async function openNavTab(page: import('@playwright/test').Page) {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible()
  await page.locator(dockTile('组件陈列')).click()
  const win = page.locator('section.absolute').filter({ has: page.locator('[role="tablist"]') })
  await expect(win).toBeVisible()
  await win.getByRole('tab', { name: '导航' }).click()
  return win
}

/**
 * S10-B 验收：键盘导航、开合与焦点归还必须用真实焦点与布局验证
 * （happy-dom 拿不到 roving tabindex / focus 的实际落点），放浏览器层。
 */

test('OsDropdown：打开落焦首项，方向键+Enter 选中并回焦触发器，Esc/外点关闭', async ({ page }) => {
  const win = await openNavTab(page)

  const trigger = win.getByRole('button', { name: '更多操作' })
  await trigger.click()
  const popup = win.getByRole('group', { name: '选项菜单' })
  await expect(popup).toBeVisible()
  // 打开后焦点直接进首项，而不是停在触发按钮上
  await expect(popup.getByRole('menuitem', { name: '新建目录' })).toBeFocused()

  await page.keyboard.press('ArrowDown')
  await expect(popup.getByRole('menuitem', { name: '新建文档' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(popup).toHaveCount(0)
  await expect(win.getByText('已选择 新建文档（演示）')).toBeVisible()
  // 选中关闭后焦点归还触发元素
  await expect(trigger).toBeFocused()

  // Esc 关闭同样归还焦点
  await trigger.click()
  await expect(popup.getByRole('menuitem', { name: '新建目录' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(popup).toHaveCount(0)
  await expect(trigger).toBeFocused()

  // 外点关闭：焦点在浮层内时关闭归还触发元素；随后浏览器默认的落点行为接管
  await trigger.click()
  await expect(popup.getByRole('menuitem', { name: '新建目录' })).toBeFocused()
  await win.getByRole('heading', { name: 'OsMenu' }).click()
  await expect(popup).toHaveCount(0)

  // hover 触发：移入打开但不劫持键盘焦点（焦点仍在「更多操作」触发按钮上）；移出关闭且不抢焦
  await trigger.focus()
  await win.getByRole('button', { name: '悬停打开' }).hover()
  await expect(popup.getByRole('menuitem', { name: '新建目录' })).toBeVisible()
  await expect(trigger).toBeFocused()
  await win.getByRole('heading', { name: 'OsMenu' }).hover()
  await expect(popup).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('OsMenu 纵向：单 tab 停靠点，→ 展开、↓ 进子级、Enter 选中写回 v-model、← 收起', async ({
  page,
}) => {
  const win = await openNavTab(page)
  const menu = win.getByRole('menu').first()
  const file = menu.getByRole('menuitem', { name: '文件' })
  const edit = menu.getByRole('menuitem', { name: '编辑' })

  await file.focus()
  await expect(file).toBeFocused()
  expect(await menu.locator('[tabindex="0"]').count()).toBe(1)

  await page.keyboard.press('ArrowDown')
  await expect(edit).toBeFocused()
  expect(await menu.locator('[tabindex="0"]').count()).toBe(1)
  await page.keyboard.press('ArrowUp')
  await expect(file).toBeFocused()

  // → 展开子菜单（不劫持焦点），↓ 才进入子级
  await page.keyboard.press('ArrowRight')
  await expect(file).toHaveAttribute('aria-expanded', 'true')
  const newDir = menu.getByRole('menuitem', { name: '新建目录' })
  const newDoc = menu.getByRole('menuitem', { name: '新建文档' })
  await expect(newDir).toBeVisible()
  // 初始 v-model 选中的是新建文档
  await expect(newDoc).toHaveClass(/bg-accent-bg/)

  await page.keyboard.press('ArrowDown')
  await expect(newDir).toBeFocused()
  await page.keyboard.press('Enter')
  // 选中写回宿主 v-model：高亮从新建文档迁移到新建目录
  await expect(newDir).toHaveClass(/bg-accent-bg/)
  await expect(newDoc).not.toHaveClass(/bg-accent-bg/)

  // ← 回父项（组保持展开），再 ← 收起
  await page.keyboard.press('ArrowLeft')
  await expect(file).toBeFocused()
  await expect(file).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('ArrowLeft')
  await expect(file).toHaveAttribute('aria-expanded', 'false')

  // disabled 项：aria-disabled，且键盘 Enter 与鼠标点击都不改变选中
  const share = menu.getByRole('menuitem', { name: '共享（禁用演示）' })
  await expect(share).toHaveAttribute('aria-disabled', 'true')
  await share.focus()
  await page.keyboard.press('Enter')
  await share.click({ force: true })
  await expect(share).not.toHaveClass(/bg-accent-bg/)
  // 选中仍留在写回宿主 v-model 的新建目录上（重新展开组验证）
  await file.focus()
  await page.keyboard.press('ArrowRight')
  await expect(menu.getByRole('menuitem', { name: '新建目录' })).toHaveClass(/bg-accent-bg/)
})

test('OsMenu 横向：←→ 换组、↓ 进子菜单、子级 ↑↓ 浏览、Esc 收组回父项、Enter 选中顶层', async ({
  page,
}) => {
  const win = await openNavTab(page)
  const menu = win.getByRole('menu').nth(1)
  const file = menu.getByRole('menuitem', { name: '文件' })
  const edit = menu.getByRole('menuitem', { name: '编辑' })
  const windowItem = menu.getByRole('menuitem', { name: '窗口' })
  const help = menu.getByRole('menuitem', { name: '帮助' })

  await file.focus()
  await expect(file).toBeFocused()

  // 顶层左右遍历，越过末项不动
  await page.keyboard.press('ArrowRight')
  await expect(edit).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(windowItem).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(help).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(help).toBeFocused()

  // 回到「文件」，↓ 打开子菜单并把焦点送进首个子项
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect(file).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(file).toHaveAttribute('aria-expanded', 'true')
  const newDir = menu.getByRole('menuitem', { name: '新建目录' })
  const newDoc = menu.getByRole('menuitem', { name: '新建文档' })
  await expect(newDir).toBeFocused()

  // 子级上下浏览；首子项再 ↑ 回到父项
  await page.keyboard.press('ArrowDown')
  await expect(newDoc).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(newDir).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(file).toBeFocused()

  // Esc 收起子菜单，焦点留在父项
  await page.keyboard.press('Escape')
  await expect(file).toHaveAttribute('aria-expanded', 'false')
  await expect(newDir).toHaveCount(0)

  // 顶层叶子 Enter 选中（非受控，高亮即证）
  await page.keyboard.press('ArrowRight')
  await expect(edit).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(edit).toHaveClass(/bg-accent-bg/)
})

test('OsBreadcrumb：超限折叠中间层级，省略号经 OsDropdown 选择后回显；末项为当前页', async ({
  page,
}) => {
  const win = await openNavTab(page)
  const nav = win.getByRole('navigation', { name: '路径导航' })
  await expect(nav).toBeVisible()

  // maxVisibleItems=3 → 首层 + 省略号 + 末层；中间层级不内联
  await expect(nav.getByRole('button', { name: '工作台' })).toBeVisible()
  await expect(nav.getByRole('button', { name: '项目资料' })).toHaveCount(0)
  const current = nav.getByRole('button', { name: '接口约定.md' })
  await expect(current).toHaveAttribute('aria-current', 'page')
  await expect(current).toBeDisabled()
  // 分隔符独立渲染且不进可及名
  await expect(nav.locator('span[aria-hidden="true"]')).toHaveCount(2)

  await nav.getByRole('button', { name: '展开省略的层级' }).click()
  const overflow = nav.getByRole('menu')
  await expect(overflow.getByRole('menuitem', { name: '技术文档' })).toBeVisible()
  await overflow.getByRole('menuitem', { name: '技术文档' }).click()
  await expect(overflow).toHaveCount(0)
  await expect(win.getByText('当前值：技术文档')).toBeVisible()
})

test('OsSteps：状态由 current 推导，按钮换步/直接点步，错误开关切 danger 态', async ({ page }) => {
  const win = await openNavTab(page)
  const steps = win.locator('ol')
  const dots = steps.locator('[data-step-indicator]')
  await expect(dots).toHaveCount(3)

  // 初始 current=1：首步完成（勾）、当前步进行中、末步等待
  await expect(dots.nth(0)).toHaveClass(/border-accent-text/)
  await expect(dots.nth(0)).not.toHaveClass(/bg-accent-bg/)
  await expect(dots.nth(1)).toHaveClass(/bg-accent-bg/)
  await expect(dots.nth(2)).toHaveClass(/text-ink-mute/)
  await expect(steps.getByRole('button', { name: /上传附件/ })).toHaveAttribute(
    'aria-current',
    'step',
  )

  // 下一步 → 进行中迁移到末步
  await win.getByRole('button', { name: '下一步' }).click()
  await expect(dots.nth(2)).toHaveClass(/bg-accent-bg/)
  await expect(steps.getByRole('button', { name: /提交完成/ })).toHaveAttribute(
    'aria-current',
    'step',
  )

  // 错误开关：当前步切 danger 配色，且不再占用 aria-current="step"
  await win.getByRole('switch').click()
  await expect(dots.nth(2)).toHaveClass(/bg-danger-bg/)
  await expect(steps.locator('[aria-current="step"]')).toHaveCount(0)
  await win.getByRole('switch').click()

  // 直接点步骤跳转（change 事件路径）
  await steps.getByRole('button', { name: /上传附件/ }).click()
  await expect(dots.nth(1)).toHaveClass(/bg-accent-bg/)
  await expect(dots.nth(2)).toHaveClass(/text-ink-mute/)

  // 上一步回到首步，按钮在首步禁用
  await win.getByRole('button', { name: '上一步' }).click()
  await expect(dots.nth(0)).toHaveClass(/bg-accent-bg/)
  await expect(win.getByRole('button', { name: '上一步' })).toBeDisabled()
})

test('文件管理路径栏迁移到 OsBreadcrumb：双击进目录末项为当前页，点祖先层级返回', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('banner')).toBeVisible()
  await page.locator(dockTile('文件管理')).click()
  const win = page.locator('section.absolute').filter({ hasText: '修改时间' })
  const nav = win.getByRole('navigation', { name: '路径导航' })

  await expect(nav.getByRole('button', { name: '我的文件' })).toHaveAttribute(
    'aria-current',
    'page',
  )

  await win.locator('tbody tr').filter({ hasText: '产品方案' }).dblclick()
  await expect(nav.getByRole('button', { name: '产品方案' })).toHaveAttribute(
    'aria-current',
    'page',
  )

  await nav.getByRole('button', { name: '我的文件' }).click()
  await expect(nav.getByRole('button', { name: '我的文件' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(nav.getByRole('button', { name: '产品方案' })).toHaveCount(0)
})
