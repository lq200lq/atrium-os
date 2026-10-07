import { expect, test, type Page } from '@playwright/test'
import { gotoShell } from './helpers'

/**
 * §9 验收里「只有浏览器能给」的两段：
 * - T13 e2e 段：手动摆放到空位 → reload → 仍落在同一格（单测段在 `widget-geometry.test.ts`，
 *   两段合起来才是 G-1/L-1 的完整判据——单测证明解算器，这一段证明落库与重放真的接上了）。
 * - T10 去色目视基线：强制三档 widget 前景同灰度后逐件出图。**只出图不做像素比对**
 *   （语义判读机器测不了，见 §9 T10 括注），但断言覆盖确实生效了——不然这张图是白画的。
 */

const FROZEN_TIME = new Date('2026-10-05T09:30:00')
const GRAY = 'rgb(128, 128, 128)'

test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })

const card = (page: Page, kind: string) => page.locator(`[data-widget-kind="${kind}"]`)

async function boxOf(page: Page, kind: string) {
  const box = await card(page, kind).boundingBox()
  expect(box, `${kind} 卡片没有矩形`).not.toBeNull()
  return box!
}

/**
 * 等矩形落定：放手那一刻卡片带着跟手位移的 transform 会被 CSS 过渡补回目标格，
 * 中途读到的是插值位置（实测比落定值差 76×12px）。判据取「连续两次读数一致」，
 * 而不是睡一段固定时间——过渡时长是 token 给的，测试不该猜它。
 */
async function stableBox(page: Page, kind: string) {
  let prev: { x: number; y: number } | null = null
  await expect
    .poll(
      async () => {
        const now = await boxOf(page, kind)
        const settled = prev !== null && prev.x === now.x && prev.y === now.y
        prev = { x: now.x, y: now.y }
        return settled ? `${now.x},${now.y}` : null
      },
      { message: `${kind} 卡片矩形未落定` },
    )
    .not.toBeNull()
  return boxOf(page, kind)
}

async function frozenShell(page: Page) {
  await page.clock.setFixedTime(FROZEN_TIME)
  await gotoShell(page)
}

/**
 * 落库屏障：等 IDB 里这条实例真的带上 {col,row}，并把它读回来。
 * `setPosition` 走的是即时 `persist()`（防抖只归配置写），但它是异步事务——
 * 直接 reload 会把没提交完的写打掉，那样测的是竞速而不是持久化。
 */
async function landedPos(page: Page, kind: string) {
  let pos: { col: number; row: number } | null = null
  await expect
    .poll(
      async () => {
        pos = await page.evaluate(readStoredPos, kind)
        return pos
      },
      { message: 'pos 没落库' },
    )
    .not.toBeNull()
  return pos!
}

function readStoredPos(kind: string): Promise<{ col: number; row: number } | null> {
  return new Promise((res, rej) => {
    const open = indexedDB.open('webos', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('kv')
    open.onerror = () => rej(open.error)
    open.onsuccess = () => {
      const db = open.result
      const get = db.transaction('kv').objectStore('kv').get('widgets-v1')
      get.onerror = () => rej(get.error)
      get.onsuccess = () => {
        db.close()
        const hit = (get.result as { kindId: string; pos: unknown }[] | undefined)?.find(
          (i) => i.kindId === kind,
        )
        res((hit?.pos as { col: number; row: number } | null | undefined) ?? null)
      }
    }
  })
}

test('T13 e2e：拖到空位后 reload，仍落在同一格且标为手动态', async ({ page }) => {
  await frozenShell(page)
  const before = await boxOf(page, 'clock')

  // 起手落在卡片本体（不是件内控件，L-10），落点取桌面左下空白区
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
  await page.mouse.down()
  await page.mouse.move(180, 620, { steps: 12 })
  await page.mouse.up()

  await expect(card(page, 'clock')).toHaveAttribute('data-widget-placed', 'manual')
  const landed = await landedPos(page, 'clock')
  const moved = await stableBox(page, 'clock')
  expect(moved).not.toEqual(before)
  expect(moved.y).toBeGreaterThan(before.y)

  await page.reload()
  await frozenShell(page)
  await expect(card(page, 'clock')).toHaveAttribute('data-widget-placed', 'manual')
  expect(await landedPos(page, 'clock')).toEqual(landed)
  // 同一格＝同一个矩形：矩形由格位解出，所以矩形相等就等于「既没漂回自动流式、也没漂半格」
  expect(await boxOf(page, 'clock')).toEqual(moved)
})

test('桌面小组件不往无障碍树里注入 landmark', async ({ page }) => {
  await frozenShell(page)
  // 这条是被 T13 撞出来的：件内用 <header> 时 Chromium 仍把它算成 banner，
  // 于是 getByRole('banner') 从一个变成三个，「跳转地标」里桌面件比页面本身还显眼。
  await expect(page.getByRole('banner')).toHaveCount(1)
  await expect(page.locator('[data-widget-id] header, [data-widget-id] footer')).toHaveCount(0)
})

test('T10 去色：三档前景压成同灰度后逐件出目视图（不断言像素）', async ({ page }) => {
  await frozenShell(page)

  // 探针取卡片里真正消费 ink 的一段文字，覆盖前后各读一次 computed color
  const probe = card(page, 'clock').locator('p, span, time, div').first()
  await expect(probe).toBeVisible()
  const inkBefore = await probe.evaluate((el) => getComputedStyle(el).color)
  expect(inkBefore).not.toBe(GRAY)

  await page.addStyleTag({
    content:
      'html { --color-widget-ink: #808080; --color-widget-ink-mute: #808080; --color-widget-ink-disabled: #808080; }',
  })
  await expect
    .poll(() => probe.evaluate((el) => getComputedStyle(el).color), {
      message: '去色覆盖没落地：卡片前景仍不是同一条灰度',
    })
    .toBe(GRAY)

  // 内置件在此视口下就是这三件（种子）；逐件出图供人眼判读「主结论是否仍成立」。
  // 但待办的首启种子是 md 空态（VFS 里没有任务），空卡片判不出任何东西。换档到 lg 也走不通：
  // 这个视口下 md 解出的锚点列在右半，lg 要占满四格，`stepSize` 按 L-3 原地放不下就拒绝
  // （实测 toast「这里放不下」）。所以内容从数据源头喂——Enter 下钻进「今日」应用录三条、关窗，
  // 再在卡片上勾掉一条：图里有「完成 1/3」这个数（H-3 的主结论通道）与两行未完成，
  // 顺带把「应用写 → 件读」这条同路径读写边在目视图里坐实。
  const todos = card(page, 'todos')
  await todos.focus()
  await page.keyboard.press('Enter')
  const todayWin = page.locator('section.rounded-panel').filter({ hasText: '今日' })
  await expect(todayWin).toBeVisible()
  const taskInput = todayWin.getByRole('textbox', { name: '添加任务，回车提交' })
  for (const title of ['去色判读甲', '去色判读乙', '去色判读丙']) {
    await taskInput.fill(title)
    await page.keyboard.press('Enter')
  }
  await todayWin.getByRole('button', { name: '关闭' }).click()
  await expect(todos.getByText(/^完成 \d+\/\d+$/)).toHaveText('完成 0/3')
  await todos.getByRole('checkbox').first().click()
  await expect(todos.getByText(/^完成 \d+\/\d+$/)).toHaveText('完成 1/3')

  // 已完成那一行默认被 `showCompleted: false` 滤掉，而它正是「不靠颜色区分完成态」（开发指南禁止事项 12）
  // 唯一的载体：三档前景压成同一条灰度后，完成态只剩勾形与划线两条通道。不打开就没图可判，
  // 所以这里从卡片菜单把开关打开，并把两条通道同时做成机器断言——图给人看，断言防日后有人删掉通道只留颜色。
  await todos.click({ button: 'right' })
  const menu = page.locator('[data-shell-menu]')
  await menu.getByRole('button', { name: '配置', exact: true }).click()
  const config = page.getByRole('dialog', { name: '今日待办 配置' })
  await config.getByRole('switch', { name: '显示已完成' }).click()
  await config.getByRole('button', { name: '完成', exact: true }).click()
  await expect(config).toHaveCount(0)

  const doneRow = todos.locator('[data-widget-interactive]').filter({
    has: page.locator('[aria-checked="true"]'),
  })
  await expect(doneRow).toHaveCount(1)
  await expect(doneRow.locator('button[role="checkbox"] svg'), '完成态要有勾形').toHaveCount(1)
  await expect(doneRow.getByText('去色判读甲')).toHaveCSS('text-decoration-line', 'line-through')

  for (const kind of ['clock', 'calendar', 'todos']) {
    await page.screenshot({
      path: `test-results/widget-mono/${kind}.png`,
      clip: await boxOf(page, kind),
    })
  }
})

test('T10 去色：管理面预览逐件出目视图（未上桌面、带样例数据的件也覆盖）', async ({ page }) => {
  await frozenShell(page)
  await page.mouse.click(320, 620, { button: 'right' })
  await page.getByRole('button', { name: '添加小组件' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.addStyleTag({
    content:
      'html { --color-widget-ink: #808080; --color-widget-ink-mute: #808080; --color-widget-ink-disabled: #808080; }',
  })

  // 预览沙箱吃的是件自带样例，所以批次 B/C 的件在这里有内容可看；
  // 上面那条只覆盖首启种子的三件，两者相加才是「逐件」。
  const rows = page.locator('[data-widget-section="catalog"] [data-widget-kind-row]')
  const kinds = await rows.evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-widget-kind-row') ?? ''),
  )
  expect(kinds.length, '目录行少于已登记件数').toBeGreaterThanOrEqual(8)

  for (const kind of kinds) {
    const row = page.locator(`[data-widget-kind-row="${kind}"]`)
    const preview = row.locator('[data-widget-preview]')
    await row.scrollIntoViewIfNeeded()
    // 预览是懒挂载 + 全局并发上限（MAX_LIVE），滚到视线内才出内容：
    // 等挂载完成再截图，否则拍到的是骨架屏，目视判读会误判成「件是空的」。
    // 判据取「有字或有图形」而不是「有子节点」——存储件曾经挂载成功却什么都不画，
    // 只数子节点会把这张白卡放过去（实测它就是靠这条断言被抓住的）。
    await expect
      .poll(
        async () =>
          preview.evaluate((el) => {
            const card = el.querySelector('[aria-hidden] > div > *')
            if (!card) return false
            if (el.querySelector('.animate-pulse')) return false
            return card.textContent!.trim().length > 0 || card.querySelector('svg') !== null
          }),
        { message: `${kind} 预览没有内容`, timeout: 15000 },
      )
      .toBe(true)
    const box = await preview.boundingBox()
    expect(box, `${kind} 预览没有矩形`).not.toBeNull()
    await page.screenshot({ path: `test-results/widget-mono/preview-${kind}.png`, clip: box! })
  }
})

/* ────────── 摆放松手反馈：落点预览（S-4/L-2）与跟手夹取 ──────────
 *
 * 起因（2026-10-07 实测，见设计文档偏差 28）：拖动中唯一能说明「会落在哪」的就是预览框，
 * 而它当时画在卡片**内部**——卡片带跟手 `transform`、材质又是 `overflow-hidden`，预览框于是
 * 屏幕坐标 = 吸附格位 + 指针位移，且越出卡片本体就被裁掉；落点等于当前格时它与卡片完全重合，
 * 用户看到的是「拖了、也跟手动了、松手却回原位，且零解释」。这一组钉四个轴：
 * ① 参考系（在层里画、整格对齐）；② 跟手与落点的差（半格以内不跳、跨过半格跳一格）；
 * ③ 夹在摆放域内（两个方向都到不了网格外）；④ 两态配色与松手后的去向。
 *
 * 读数时序：先 poll 一个**必定会变**的值确认该帧渲染已落地，再读预览框——直接读一次会读到上一帧
 * （实测踩过：指针移完立刻读预览框，拿到的还是没换格之前的位置）；
 * 「什么都没写」的判据要越过静默地板（同偏差 21 的口径，不拿两次相邻读数相等当证明）。
 */

const PITCH = 68 + 24
const GRID_ORIGIN_X = 84 // 1280 - 24 - 1172
const GRID_ORIGIN_Y = 68 // 44 + 24
const DESKTOP_RIGHT = 1280 - 24
const QUIET_FLOOR = 2 * 300

const ghostOf = (page: Page) => page.locator('[data-widget-ghost]')

/**
 * 预览框边框的「红度」：合法/拒绝两态靠颜色区分，所以按实测颜色判、不写死 token 值。
 * computed 值可能是 `rgb()` 也可能是 `oklab()`（color-mix 在 oklab 空间求值），两种都认，
 * 归一到同一量纲（红-绿轴）只用于「拒绝态更红」这个比较。
 */
async function ghostRedness(page: Page): Promise<number> {
  const css = await ghostOf(page).evaluate((el) => getComputedStyle(el).borderTopColor)
  const rgb = css.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/)
  if (rgb) return Number(rgb[1]) - (Number(rgb[2]) + Number(rgb[3])) / 2
  const oklab = css.match(/oklab\(([^)]+)\)/)
  expect(oklab, `预览框边框色不认识的写法：${css}`).not.toBeNull()
  const nums = [...oklab![1].matchAll(/-?\d*\.?\d+/g)].map((m) => Number(m[0]))
  expect(nums.length, `oklab 分量不足：${css}`).toBeGreaterThanOrEqual(3)
  return nums[1] * 255
}

/** 抓握卡片本体（不是件内控件）并按住；返回起手矩形与指针落点 */
async function grabCenter(page: Page, kind: string) {
  const box = await boxOf(page, kind)
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.move(at.x, at.y)
  await page.mouse.down()
  return { box, at }
}

/** poll 到「卡片相对起手点的位移」＝期望值：这一步同时证明该帧渲染已落地 */
async function expectCardShift(
  page: Page,
  kind: string,
  from: { x: number; y: number },
  dx: number,
  dy = 0,
) {
  await expect
    .poll(async () => {
      const now = await boxOf(page, kind)
      return `${Math.round(now.x - from.x)},${Math.round(now.y - from.y)}`
    })
    .toBe(`${Math.round(dx)},${Math.round(dy)}`)
}

/** poll 到预览框相对某点的位移＝期望值（预览框的渲染同样是异步落地的） */
async function expectGhostShift(page: Page, from: { x: number; y: number }, dx: number, dy = 0) {
  await expect
    .poll(async () => {
      const g = await ghostOf(page).boundingBox()
      return g ? `${Math.round(g.x - from.x)},${Math.round(g.y - from.y)}` : 'none'
    })
    .toBe(`${Math.round(dx)},${Math.round(dy)}`)
}

test('落点预览画在桌面坐标里：整格对齐、半格以内不跳、跨过半格跳一格、松手落在预览上', async ({
  page,
}) => {
  await frozenShell(page)
  const ghost = ghostOf(page)
  const { box: before, at } = await grabCenter(page, 'clock')

  // ① 参考系：起手即有预览，贴在卡片当前所在的那一格（与卡片矩形同值）
  await expect(ghost).toHaveCount(1)
  const atStart = (await ghost.boundingBox())!
  expect(atStart).toEqual(before)
  // 它在层里、不在被拖卡片内 ⇒ 既不被卡片的跟手 transform 带走，也不被 overflow-hidden 裁掉
  expect(await ghost.evaluate((el) => el.closest('[data-widget-id]') === null)).toBe(true)
  // 落点必然是整格：与摆放域左/上缘的差是 pitch 的整数倍（L-2 的「不存在半格状态」）
  expect((atStart.x - GRID_ORIGIN_X) % PITCH).toBe(0)
  expect((atStart.y - GRID_ORIGIN_Y) % PITCH).toBe(0)

  // ② 不到半格（40 < 46）：卡片跟手走了 40，预览一动不动
  await page.mouse.move(at.x - 40, at.y)
  await expectCardShift(page, 'clock', before, -40)
  expect(await ghost.boundingBox()).toEqual(atStart)

  // 跨过半格（60 ≥ 46）：预览正好跳一个 pitch
  await page.mouse.move(at.x - 60, at.y)
  await expectCardShift(page, 'clock', before, -60)
  const jumped = (await ghost.boundingBox())!
  expect(Math.round(atStart.x - jumped.x)).toBe(PITCH)
  expect(Math.round(jumped.y)).toBe(Math.round(atStart.y))
  // 不变式：预览框（落点）与卡片视觉位置相距不超过半格——「跟手」与「吸附」的差额就只有这个余量
  const following = await boxOf(page, 'clock')
  expect(Math.abs(jumped.x - following.x)).toBeLessThanOrEqual(PITCH / 2)
  expect(Math.abs(jumped.y - following.y)).toBeLessThanOrEqual(PITCH / 2)

  // ③ 松手：卡片落在预览框那一格上（视觉承诺兑现），预览框随即消失
  await page.mouse.up()
  await expect(ghost).toHaveCount(0)
  const landed = await stableBox(page, 'clock')
  expect(Math.round(landed.x)).toBe(Math.round(jumped.x))
  expect(Math.round(landed.y)).toBe(Math.round(jumped.y))
  expect(await landedPos(page, 'clock')).not.toBeNull()
})

test('跟手位移夹在摆放域内：往右拖不越出网格，往左最多贴到最左合法列', async ({ page }) => {
  await frozenShell(page)
  const ghost = ghostOf(page)
  const { box: before, at } = await grabCenter(page, 'clock')
  // 前置自证：这一屏要测「贴右缘的件往右拖」，卡片必须先真的贴住右内边距
  expect(Math.round(before.x + before.width)).toBe(DESKTOP_RIGHT)
  await expect(ghost).toHaveCount(1)
  const atStart = (await ghost.boundingBox())!

  // 往左拖到视口左缘：夹到摆放域左缘，预览落在最左合法格（两者在极值处重合）
  await page.mouse.move(10, at.y)
  await expectCardShift(page, 'clock', before, GRID_ORIGIN_X - before.x)
  await expectGhostShift(page, atStart, GRID_ORIGIN_X - atStart.x)
  expect(Math.round((await ghost.boundingBox())!.x)).toBe(GRID_ORIGIN_X)

  // 往右拖到视口右缘：回到贴右缘（夹取上限＝起手那一格），预览回到起点那一格
  await page.mouse.move(1270, at.y)
  await expectCardShift(page, 'clock', before, 0)
  await expectGhostShift(page, atStart, 0)
  expect(await boxOf(page, 'clock')).toEqual(before)

  // 原地松手：落点＝当前格，一次静默的空操作——不写库、不离位、也不弹提示
  await page.mouse.up()
  await expect(ghost).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.waitForTimeout(QUIET_FLOOR)
  expect(await page.evaluate(readStoredPos, 'clock')).toBeNull()
  expect(await stableBox(page, 'clock')).toEqual(before)
})

test('拖到被占格：预览框先变拒绝态，松手回弹 + 一次短提示（L-3/L-8）', async ({ page }) => {
  await frozenShell(page)
  const ghost = ghostOf(page)
  const before = await boxOf(page, 'clock')
  const calendar = await boxOf(page, 'calendar')
  // 前置自证：这一屏要测「拖到被占格」，月历必须在时钟正下方两格
  expect(Math.round(calendar.x)).toBe(Math.round(before.x))
  expect(Math.round(calendar.y - before.y)).toBe(2 * PITCH)

  const { at } = await grabCenter(page, 'clock')
  await expect(ghost).toHaveCount(1)
  const valid = await ghostRedness(page)

  await page.mouse.move(at.x, at.y + 2 * PITCH) // 落到月历那一格
  await expectGhostShift(page, before, 0, 2 * PITCH)
  const invalid = await ghostRedness(page)
  // 两态在颜色上真的不同，且拒绝态更红（颜色是这条判据的载体，不能只靠文案）
  expect(invalid).not.toBe(valid)
  expect(invalid).toBeGreaterThan(0)
  expect(invalid).toBeGreaterThan(valid)

  await page.mouse.up()
  await expect(ghost).toHaveCount(0)
  await expect(page.getByRole('alert')).toContainText('这里放不下')
  await page.waitForTimeout(QUIET_FLOOR)
  expect(await page.evaluate(readStoredPos, 'clock')).toBeNull()
  expect(await stableBox(page, 'clock')).toEqual(before)
})

/** 用户报障那一屏的几何：972×875（cols=10 / rows=7）⇒ originX = 972-24-(10*68+9*24) = 52 */
const USER_VIEW_ORIGIN_X = 972 - 24 - (10 * 68 + 9 * 24)

test.describe('原报场景复现：972×875（cols=10）下待办贴右缘往右拖', () => {
  test.use({ viewport: { width: 972, height: 875 }, reducedMotion: 'reduce' })

  test('卡片一格都不动、预览留在原格、松手静默回原位（这条屏是用户截图那一屏）', async ({
    page,
  }) => {
    await frozenShell(page)
    const card = page.locator('[data-widget-kind="todos"]')
    const ghost = ghostOf(page)
    const before = (await card.boundingBox())!
    // 前置自证：待办 md 在这一屏真的贴在右内边距上（972 - 24 = 948），否则这条腿测的不是那个场景
    expect(Math.round(before.x + before.width)).toBe(972 - 24)
    const at = { x: before.x + before.width / 2, y: before.y + before.height / 2 }

    await page.mouse.move(at.x, at.y)
    await page.mouse.down()
    await expect(ghost).toHaveCount(1)
    const atStart = (await ghost.boundingBox())!
    expect(atStart).toEqual(before)

    // 先用「往左拖」证明这一屏的渲染链路是活的（必定会变的值，poll 到位再读预览框）
    await page.mouse.move(10, at.y)
    await expectCardShift(page, 'todos', before, USER_VIEW_ORIGIN_X - before.x)
    await expectGhostShift(page, atStart, USER_VIEW_ORIGIN_X - atStart.x)

    // 再往右拖：已在最右列 ⇒ 卡片与预览都停在起点那一格（原报里卡片曾跟手飘出网格）
    await page.mouse.move(970, at.y)
    await expectCardShift(page, 'todos', before, 0)
    await expectGhostShift(page, atStart, 0)
    expect(await card.boundingBox()).toEqual(before)

    // 松手：静默回原位、不写库（越过静默地板再读，同偏差 21 的口径）
    await page.mouse.up()
    await expect(ghost).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await page.waitForTimeout(QUIET_FLOOR)
    expect(await page.evaluate(readStoredPos, 'todos')).toBeNull()
    expect(await stableBox(page, 'todos')).toEqual(before)
  })
})
