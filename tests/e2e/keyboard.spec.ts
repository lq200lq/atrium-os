import { expect, test, type Page } from '@playwright/test'
import { dockTile, gotoShell } from './helpers'

/**
 * S12 键盘与焦点规范验收（配合 focus.spec.ts 的焦点环基线）：
 * ① ⌘K/ctrl+K 是 Spotlight 的开合开关；② 方向键在结果列表上移动活动项；
 * ③ Esc 关闭对话框/抽屉并把焦点还给触发元素；④ 纯 Tab 从壳层顶部走得到通知铃铛与 Dock，顺序与 DOM 一致。
 */

const spotlightInput = (page: Page) => page.locator('input[placeholder="搜索应用与文件…"]')

/** 当前活动项（Spotlight 用 aria-current 标记光标位） */
const activeHit = (page: Page) => page.locator('[aria-current="true"]').first()

async function focusedInfo(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return null
    const zone = el.closest('header') ? 'topbar' : el.closest('nav') ? 'dock' : 'other'
    const cs = getComputedStyle(el)
    return {
      zone,
      tag: el.tagName,
      name: (el.getAttribute('aria-label') || el.title || el.textContent || '').trim().slice(0, 24),
      outlineWidth: parseFloat(cs.outlineWidth) || 0,
      outlineStyle: cs.outlineStyle,
    }
  })
}

test('⌘K/ctrl+K 开合 Spotlight 两处都可退', async ({ page }) => {
  await gotoShell(page)
  await expect(page.getByRole('banner')).toBeVisible()

  await page.keyboard.press('Control+k')
  await expect(spotlightInput(page)).toBeVisible()

  // 再按一次是「关」而不是重复开（S12 补齐的开合语义）
  await page.keyboard.press('Control+k')
  await expect(spotlightInput(page)).toHaveCount(0)

  await page.keyboard.press('Control+k')
  await expect(spotlightInput(page)).toBeVisible()
  await page.keyboard.press('Control+k')
  await expect(spotlightInput(page)).toHaveCount(0)

  // 同款开合对真 ⌘（metaKey）也成立（顶栏 kbd 提示的即此键位）
  await page.keyboard.press('Meta+k')
  await expect(spotlightInput(page)).toBeVisible()
  await page.keyboard.press('Meta+k')
  await expect(spotlightInput(page)).toHaveCount(0)

  await page.keyboard.press('Control+k')
  await expect(spotlightInput(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(spotlightInput(page)).toHaveCount(0)
})

test('Spotlight 方向键移动活动项', async ({ page }) => {
  await gotoShell(page)
  await expect(page.getByRole('banner')).toBeVisible()
  await page.keyboard.press('Control+k')
  await expect(spotlightInput(page)).toBeVisible()

  const first = await activeHit(page).textContent()
  expect((first ?? '').trim().length, '默认应有活动项').toBeGreaterThan(0)

  await page.keyboard.press('ArrowDown')
  const second = await activeHit(page).textContent()
  expect(second).not.toBe(first)
  // 光标位与列表按钮绑定：活动项始终是列表中的一个结果
  await expect(activeHit(page)).toHaveAttribute('aria-current', 'true')

  await page.keyboard.press('ArrowUp')
  await expect(activeHit(page)).toHaveText(first ?? '')
})

test('Esc 关闭对话框并聚焦回触发元素', async ({ page }) => {
  await gotoShell(page)
  await page.locator(dockTile('数据看板')).click()
  const win = page.locator('section.absolute').filter({ hasText: '统计概览' })
  await expect(win).toBeVisible()

  const createBtn = win.getByRole('button', { name: '新增', exact: true })
  await createBtn.click()
  const dialog = page.getByRole('dialog', { name: '新增员工' })
  await expect(dialog).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  // 焦点原路归还：关闭后仍能被 Tab 继续用的入口就是刚才那颗按钮
  await expect(createBtn).toBeFocused()
})

test('Esc 关闭抽屉并把焦点还给触发按钮', async ({ page }) => {
  await gotoShell(page)
  await page.locator(dockTile('组件陈列')).click()
  const win = page.locator('section.absolute').filter({ has: page.locator('[role="tablist"]') })
  await expect(win).toBeVisible()
  await win.locator('[role="tab"]').filter({ hasText: '反馈' }).click()

  const trigger = page.getByRole('button', { name: '打开 Drawer' })
  await trigger.click()
  const drawer = page.locator('aside[role="dialog"]')
  await expect(drawer).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(drawer, '抽屉必须能从键盘原路退出').toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('Spotlight Esc 关闭后焦点归还顶栏搜索入口', async ({ page }) => {
  await gotoShell(page)
  const searchBtn = page.locator('header button', { hasText: '⌘K' })
  await searchBtn.click()
  await expect(spotlightInput(page)).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(spotlightInput(page)).toHaveCount(0)
  await expect(searchBtn).toBeFocused()
})

test('纯 Tab 可达：顶栏先于 Dock，铃铛有可见焦点环', async ({ page }) => {
  await gotoShell(page)
  await expect(page.getByRole('banner')).toBeVisible()

  const trail: NonNullable<Awaited<ReturnType<typeof focusedInfo>>>[] = []
  for (let i = 0; i < 40 && !trail.some((t) => t.zone === 'dock'); i++) {
    await page.keyboard.press('Tab')
    const info = await focusedInfo(page)
    if (info) trail.push(info)
  }

  expect(trail.length, 'Tab 应有落点').toBeGreaterThan(0)

  const bell = trail.findIndex((t) => t.name === '通知')
  const dock = trail.findIndex((t) => t.zone === 'dock')
  const topbar = trail.findIndex((t) => t.zone === 'topbar')
  expect(bell, 'Tab 可达通知中心铃铛').toBeGreaterThanOrEqual(0)
  expect(dock, 'Tab 可达 Dock 磁贴').toBeGreaterThanOrEqual(0)
  expect(topbar, 'Tab 先走壳层顶栏').toBeGreaterThanOrEqual(0)
  expect(topbar, 'DOM 顺序：顶栏在 Dock 之前').toBeLessThan(dock)
  expect(bell, 'DOM 顺序：铃铛在 Dock 之前').toBeLessThan(dock)

  // 键盘焦点必须戴 token 环（≥2px），不是浏览器默认隐身样式
  const bellStop = trail[bell]
  expect(bellStop.outlineStyle).not.toBe('none')
  expect(bellStop.outlineWidth).toBeGreaterThanOrEqual(2)
})
