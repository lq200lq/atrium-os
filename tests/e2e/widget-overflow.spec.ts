import { expect, test, type Page } from '@playwright/test'
import { gotoShell } from './helpers'

/**
 * §4.7 第 3 步「溢出治理」的动线判据：`+N 个未显示` 从黑箱数字升级为**可展开清单**，
 * 每行给件名、当前档、成因与三个动作（换小一档 / 移除 / 打开管理台并定位到那一行）。
 *
 * 播种走 IndexedDB（`widgets-v1`）而不是逐件点「添加」：溢出要**确定性地**发生，
 * 靠点击攒件会把用例绑在落位算法的步长上。冷启那次 `seedDefaults()` 的落库是
 * fire-and-forget，可能盖掉播种，所以「写→读回」重试到读回来的就是播种那份再 reload
 * （同一手法见 `widget-acceptance.spec.ts` 的 mount，此处只需 widgets 一条通道）。
 */

type WidgetSize = 'sm' | 'md' | 'lg'

const WIDGETS_KEY = 'widgets-v1'
const SIZE_LABEL: Record<WidgetSize, string> = { sm: '小', md: '中', lg: '大' }

interface SeedItem {
  id: string
  kindId: string
  size: WidgetSize
  pos: { col: number; row: number } | null
  addedAt: number
}

/** 挑有 lg 档的件：lg 最占格，小视口下必然挤出溢出；且 lg 一律「可换小一档」 */
const OVERFLOW_KINDS = ['clock', 'calendar', 'todos', 'recent-files', 'sticky-note'] as const

/** 这五件的显示名（`widgets.names.*` 的 zh 取值）：行内认件名用，不认具体哪件溢出——那是落位算法的事 */
const NAMES = ['时钟', '月历', '今日待办', '最近文件', '便签']
const NAMES_PATTERN = new RegExp(NAMES.join('|'))

const overflowButton = (page: Page) => page.getByRole('button', { name: /\d+ 个未显示/ })

const list = (page: Page) => page.locator('#widget-overflow-list')

const rows = (page: Page) => page.locator('#widget-overflow-list li[data-widget-overflow-entry]')

/**
 * 抽屉的页内入口只有两处：桌面右键菜单与溢出清单页脚的「管理小组件…」。右键要猜空白壁纸
 * 坐标，落点随视口与落位算法漂移（标语、卡片、Dock 都能盖住它）；这里走后者——溢出在本用例
 * 里本就成立，页脚按钮的位置也就是确定的，不必猜坐标。
 */
async function openGallery(page: Page): Promise<void> {
  await expect(
    overflowButton(page),
    '移除一件后仍应有溢出，否则页脚这个入口不存在（用例前提变了）',
  ).toBeVisible()
  await overflowButton(page).click()
  await list(page).getByRole('button', { name: '管理小组件' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

async function writeKv(page: Page, key: string, value: unknown): Promise<void> {
  await page.evaluate(
    async ([k, v]: [string, unknown]) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('atrium-os', 1)
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv')
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('kv', 'readwrite')
          tx.objectStore('kv').put(JSON.parse(JSON.stringify(v)) as never, k)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
      } finally {
        db.close()
      }
    },
    [key, value] as [string, unknown],
  )
}

async function readIds(page: Page): Promise<string[]> {
  const items = await page.evaluate(async (key: string) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('atrium-os', 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    const value = await new Promise<SeedItem[] | undefined>((resolve, reject) => {
      const req = db.transaction('kv').objectStore('kv').get(key)
      req.onsuccess = () => resolve(req.result as SeedItem[] | undefined)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return value
  }, WIDGETS_KEY)
  return (items ?? []).map((i) => i.id)
}

/** 播种到「库里就是这一份」，再 reload 让件走 restoreInstances 的真实还原路径 */
async function seed(page: Page, items: SeedItem[]): Promise<void> {
  const want = items.map((i) => i.id)
  await gotoShell(page)
  await expect
    .poll(
      async () => {
        await writeKv(page, WIDGETS_KEY, items)
        return JSON.stringify(await readIds(page))
      },
      { timeout: 15_000, intervals: [100, 300, 600] },
    )
    .toBe(JSON.stringify(want))
  await page.reload()
  await expect(page.getByRole('banner')).toBeVisible()
}

async function seedOverflow(page: Page): Promise<SeedItem[]> {
  const items: SeedItem[] = OVERFLOW_KINDS.map((kindId, i) => ({
    id: `wgt-overflow-${kindId}`,
    kindId,
    size: 'lg',
    pos: null,
    addedAt: i + 1,
  }))
  await seed(page, items)
  return items
}

test.describe('溢出治理清单（§4.7 第 3 步：不是黑箱数字，是可处置的出口）', () => {
  // 小视口 + 五件 lg ⇒ 桌面装不下，溢出必然发生
  test.use({ viewport: { width: 900, height: 620 } })

  test('清单给出件名、当前档、成因与三个动作', async ({ page }) => {
    await seedOverflow(page)
    await expect(overflowButton(page)).toBeVisible()
    await overflowButton(page).click()
    await expect(list(page)).toBeVisible()

    // 哪几件溢出由落位算法决定，用例只认「行」不认件名：行里三件事齐备——
    // 说清是哪个件（OsAppTile 带 kind 图标 + 名称）、什么档、为什么放不下，外加三个处置动作。
    const row = rows(page).first()
    await expect(row).toBeVisible()
    await expect(row, '行内应带件名').toContainText(NAMES_PATTERN)
    await expect(row, '行内应带当前档').toContainText(SIZE_LABEL.lg)
    await expect(row, '行内应带成因文案').toContainText(/桌面已放满|位置重叠|超出当前桌面/)
    await expect(row.getByRole('button', { name: '换小一档' })).toBeVisible()
    await expect(row.getByRole('button', { name: '移除', exact: true })).toBeVisible()
    await expect(row.getByRole('button', { name: '在管理台定位' })).toBeVisible()
  })

  test('换小一档就地生效：那一行离开清单、卡片以低一档上桌面', async ({ page }) => {
    const items = await seedOverflow(page)
    await overflowButton(page).click()
    const row = rows(page).first()
    await expect(row).toBeVisible()
    const id = await row.getAttribute('data-instance-id')
    const kind = items.find((i) => i.id === id)!.kindId

    await row.getByRole('button', { name: '换小一档' }).click()
    // 落位是同步的（setSize → placeWidgets），「换档生效」有两个可见处：
    // 要么以 md 上了桌面，要么仍在清单里但那一行已改标「中」。二者必居其一——
    // 点了没反应在这条判据下过不了（清单行按 data-instance-id 认，别用 has 自证）。
    const onDesktop = page.locator(`[data-widget-id="${id}"][data-widget-size="md"]`)
    const stillList = page
      .locator(`#widget-overflow-list li[data-instance-id="${id}"]`)
      .filter({ hasText: SIZE_LABEL.md })
    await expect(
      onDesktop.or(stillList),
      `${kind} 换小一档后应以 md 现身（桌面上或清单行里）`,
    ).toHaveCount(1)
    await expect(
      page.locator(`#widget-overflow-list li[data-instance-id="${id}"]`).filter({
        hasText: SIZE_LABEL.lg,
      }),
      '同一行不该还标着「大」',
    ).toHaveCount(0)
  })

  test('移除就地生效：件从桌面与管理面两处一起消失', async ({ page }) => {
    const items = await seedOverflow(page)
    await overflowButton(page).click()
    const row = rows(page).first()
    const id = await row.getAttribute('data-instance-id')
    await expect(row).toBeVisible()

    await row.getByRole('button', { name: '移除', exact: true }).click()
    await expect
      .poll(() => readIds(page), '移除应落库')
      .toEqual(items.map((i) => i.id).filter((x) => x !== id))

    await page.reload()
    await expect(page.locator(`[data-widget-id="${id}"]`)).toHaveCount(0)
    // 管理面实例行也不该再有它（清单与抽屉读的是同一个 store）
    await openGallery(page)
    await expect(page.locator(`[data-widget-instance-row="${id}"]`)).toHaveCount(0)
  })

  test('在管理台定位：开抽屉并把那一行展开滚进视线', async ({ page }) => {
    await seedOverflow(page)
    await overflowButton(page).click()
    const row = rows(page).first()
    await expect(row).toBeVisible()
    const id = await row.getAttribute('data-instance-id')

    await row.getByRole('button', { name: '在管理台定位' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    const instanceRow = page.locator(`[data-widget-instance-row="${id}"]`)
    await expect(instanceRow, '定位到的实例行应在视线内').toBeInViewport()
    await expect(
      instanceRow.locator('[data-widget-config-panel]'),
      'focusInstanceId 应把这一行的配置面板展开',
    ).toBeVisible()
    // 只有被定位的那一行展开，其余实例行保持收起
    await expect(page.locator('[data-widget-instance-row] [data-widget-config-panel]')).toHaveCount(
      1,
    )
  })
})

/**
 * 动态溢出（宽 → 窄 → 宽）。上面四条的溢出是**静态播种**出来的：进壳层那一刻就放不下，
 * 卡片从未上过桌面，也就从未卸载过——于是「卡片离开 DOM 顺手把自己的运行态清掉」这类
 * 只在**跃迁**里暴露的缺陷，它们一条都测不到（§4.10 曾据此静默吞掉一张卡）。
 * 这条腿走的正是用户真实会遇到的动线：桌面上本来放得下，把窗口拖窄才挤出一件。
 */
test.describe('动态溢出：视口变窄挤出的那一件必须进清单，而不是静默消失', () => {
  const cards = (page: Page) => page.locator('[data-widget-id]')

  test('三件 md 宽桌面全放下，窄到装不下时那张进清单、回宽后自己回来', async ({ page }) => {
    // 1280×800 下 cols=17 ⇒ 4 个 band，三件 md 各自有落位；700×700 下 cols=7 ⇒ 只剩 1 个
    // band、纵向只塞得下两张 ⇒ 第三件必然溢出，无需依赖具体落位次序
    await page.setViewportSize({ width: 1280, height: 800 })
    await seed(
      page,
      (['clock', 'calendar', 'todos'] as const).map((kindId, i) => ({
        id: `wgt-narrow-${kindId}`,
        kindId,
        size: 'md' as const,
        pos: null,
        addedAt: i + 1,
      })),
    )
    await expect(cards(page)).toHaveCount(3)
    await expect(overflowButton(page)).toHaveCount(0)

    await page.setViewportSize({ width: 700, height: 700 })
    await expect(cards(page)).toHaveCount(2)
    // 黑箱数字升级为出口：变窄后必须冒出处置入口，缺它就是在静默吞件
    await expect(overflowButton(page), '变窄挤出的那一件应有「+N 个未显示」出口').toBeVisible()
    await overflowButton(page).click()
    const dropped = rows(page).filter({ hasText: '今日待办' })
    await expect(dropped).toHaveCount(1)
    await expect(dropped).toContainText(SIZE_LABEL.md)
    await expect(dropped).toContainText('桌面已放满')

    // 回宽：同一实例自己回到桌面，不需要重新添加，也不该留下幽灵溢出
    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(cards(page)).toHaveCount(3)
    await expect(page.locator('#widget-overflow-list')).toHaveCount(0)
    await expect(overflowButton(page)).toHaveCount(0)
  })
})

/**
 * 溢出出口在**最窄可用视口**上仍然可用（§4.10 的出口不能只在 900×620 成立）。
 * 清单从层角朝上开（`bottom-full`）且宽度受 `calc(100vw-48px)` 约束：视口越矮越窄，
 * 越容易把行推出屏幕或让按钮被裁掉——那等于把出口换成一个看不见的出口。
 * 这里不猜像素：逐行断言「在视口内」，再真点一次「移除」，点得动才算数。
 */
test.describe('溢出清单在最窄视口上仍处置得动（560×800）', () => {
  test.use({ viewport: { width: 560, height: 800 } })

  test('清单每一行都在视口内，且「移除」真点得动', async ({ page }) => {
    const items = await seedOverflow(page)
    await expect(overflowButton(page)).toBeVisible()
    await overflowButton(page).click()
    await expect(list(page)).toBeVisible()

    const count = await rows(page).count()
    expect(count, '五件 lg 在 560×800 下必然挤出溢出').toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      const row = rows(page).nth(i)
      await expect(row, `第 ${i + 1} 行整行应在视口内`).toBeInViewport({ ratio: 0.9 })
      // 三个处置动作都要在视口内且可点（Playwright 的 actionability 会拒绝被遮挡的目标）
      for (const name of ['换小一档', '移除', '在管理台定位']) {
        await expect(
          row.getByRole('button', { name, exact: name === '移除' }),
          `第 ${i + 1} 行的「${name}」应在视口内`,
        ).toBeInViewport({ ratio: 0.9 })
      }
    }

    const id = await rows(page).first().getAttribute('data-instance-id')
    await rows(page).first().getByRole('button', { name: '移除', exact: true }).click()
    await expect
      .poll(() => readIds(page), '窄视口下的移除也要落库')
      .toEqual(items.map((i) => i.id).filter((x) => x !== id))
  })
})
