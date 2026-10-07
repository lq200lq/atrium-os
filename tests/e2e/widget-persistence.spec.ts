import { expect, test, type Page, type Locator } from '@playwright/test'
import { dockTile, gotoShell } from './helpers'

/**
 * §9 T1「持久化往返：每个写操作 → reload → 状态仍在」的**逐件 UI 腿**。
 *
 * store 层往返（`widgets-v1` 写了什么、`restoreInstances` 还原成什么）已由
 * `tests/unit/widgets.test.ts` 钉住；这一份要证的是整条链——真实点击 → store → IndexedDB →
 * hydrate → 画出来的 DOM。所以断言一律打在 DOM 上（卡片属性 + 档位像素 + 件内文字），
 * 不读 store：只有库真的存住了，reload 之后这张卡才会以同一实例、同一档、同一份内容重新出现。
 *
 * 档位一律挑**非缺省**那一档（`PER_KIND`）：缺省档就算写丢了也会被 `restoreInstances` 的
 * 「manifest 没声明的档收敛到 defaultSize」补回来，测不出往返（widget-acceptance 的 mount 同理）。
 *
 * 落库都是 fire-and-forget（`widgets.persist` / `vfs.persist`），配置与件数据还各叠了
 * 300ms 防抖（`CONFIG_PERSIST_DEBOUNCE` / `DATA_WRITE_DEBOUNCE`）：reload 前一律把库读到
 * 期望值（`expectPersisted`），不用 waitForTimeout——等待由断言自己消化，慢机器也不会假绿。
 * 同一件内连着两次写之间也过这道屏障：它把「库里有这一条」变成判据的一部分，而不是让用例
 * 依赖防抖合并的时序。防抖窗口内的多次写必须逐条累计（那是 `useWidgetData` 的契约，单位级判据
 * 见 `tests/unit/widget-data-debounce.test.ts`，动线判据见本文件的 todos 连按两条 Enter 那条）。
 */

type WidgetSize = 'sm' | 'md' | 'lg'

/** 十件 × 各自 manifest.widget.sizes（与 tests/e2e/widget-acceptance.spec.ts 同源的两份持有：谁漂了用例红） */
const KIND_SIZES = {
  clock: ['sm', 'md', 'lg'],
  calendar: ['md', 'lg'],
  todos: ['md', 'lg'],
  storage: ['sm', 'md'],
  'recent-files': ['md', 'lg'],
  system: ['sm', 'md'],
  'sticky-note': ['sm', 'md', 'lg'],
  'control-center': ['md', 'lg'],
  'notification-summary': ['sm', 'md'],
  'data-summary': ['md'],
} satisfies Record<string, WidgetSize[]>

type Kind = keyof typeof KIND_SIZES

const SIZE_LABEL: Record<WidgetSize, string> = { sm: '小', md: '中', lg: '大' }
/** geometry.ts 的档位像素（CELL 68 / GUTTER 24）：属性之外再钉一层真实盒 */
const SIZE_PX: Record<WidgetSize, { w: number; h: number }> = {
  sm: { w: 160, h: 160 },
  md: { w: 344, h: 160 },
  lg: { w: 344, h: 344 },
}

const WIDGETS_KEY = 'widgets-v1'
/** = `src/kernel/stores/vfs.ts` 的 FS_KEY：todos / calendar / sticky-note 的数据都在这棵树里 */
const FS_KEY = 'fs-v1'
const THEME_KEY = 'theme-v1'

/** 件数据的落点：shared 走 `/我的数据/<key>.json`，instance 走 `/我的数据/<kind>/<id>.json`（widgetData.ts） */
const TASKS_PATH = '/我的数据/tasks.json'
const notePath = (instanceId: string) => `/我的数据/sticky-note/${instanceId}.json`

interface PersistedInstance {
  id: string
  kindId: string
  size: WidgetSize
  pos: { col: number; row: number } | null
  config?: Record<string, string | number | boolean>
  addedAt: number
}

interface FsNodeLite {
  type: string
  content?: string
}

/**
 * 每件挑的档位 + 它的写路径（写进标题，好让「这件没有写路径」在报告里是可读的、而不是靠缺席表达）。
 * 配置写路径按**机制**覆盖两条（clock 的 `configEntry` 自绘 / todos 的 schema 缺省渲染）：
 * 六件 × 配置落的是同一条 `updateConfig → sanitizeConfig → persistDebounced`，
 * 逐件重跑只是把同一段代码抄六遍，档位与 DOM 判据留在各自那一行里。
 */
const PER_KIND: { kind: Kind; size: WidgetSize; write: string }[] = [
  { kind: 'clock', size: 'lg', write: '写路径＝配置（configEntry 自绘面板，另有一条用例）' },
  {
    kind: 'calendar',
    size: 'lg',
    write: '只读 events.json，件内没有写路径（日程由「今日」应用写入）',
  },
  { kind: 'todos', size: 'lg', write: '写路径＝卡内新增/勾选/删除（另两条用例）' },
  { kind: 'storage', size: 'md', write: '只读 navigator.storage 与 VFS 目录树，无自有数据文件' },
  { kind: 'recent-files', size: 'lg', write: '只读 VFS 节点表，无自有数据文件（写归文件管理）' },
  { kind: 'system', size: 'md', write: '只读 navigator.*，无自有数据（写只剩配置 metric）' },
  { kind: 'sticky-note', size: 'lg', write: '写路径＝lg 的 textarea（实例域文件，另有一条用例）' },
  { kind: 'control-center', size: 'lg', write: '写路径＝卡内开关（theme-v1，另有一条用例）' },
  { kind: 'notification-summary', size: 'md', write: '只读 notification store，件内不写也无配置' },
  {
    kind: 'data-summary',
    size: 'md',
    write: '只读 orgSeed fixture；单档且无配置无数据 ⇒ 无写路径',
  },
]

/* ─────────────────────────── 库读回（reload 前的确定性屏障） ─────────────────────────── */

async function readKv(page: Page, keys: string[]): Promise<Record<string, unknown>> {
  return page.evaluate(async (ks: string[]) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('webos', 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    const out: Record<string, unknown> = {}
    for (const key of ks) {
      out[key] = await new Promise((resolve, reject) => {
        const req = db.transaction('kv').objectStore('kv').get(key)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
    }
    db.close()
    return out
  }, keys)
}

/** 把库读到期望值再 reload：写是 fire-and-forget + 300ms 防抖，这一步就是「已经落库」的证据 */
async function expectPersisted(
  page: Page,
  key: string,
  project: (raw: unknown) => unknown,
  expected: unknown,
): Promise<void> {
  await expect
    .poll(async () => project((await readKv(page, [key]))[key] ?? null), {
      timeout: 15_000,
      intervals: [100, 300, 600],
    })
    .toEqual(expected)
}

const instanceDigest = (raw: unknown, id: string) => {
  const hit = ((raw ?? []) as PersistedInstance[]).find((i) => i.id === id)
  return hit ? [hit.kindId, hit.size] : null
}

/** 件数据文件：把 JSON 内容摊成可比对的投影（id/createdAt 是随机数，不参与判定） */
const fileDigest = (path: string, project: (json: Record<string, unknown>) => unknown) => {
  return (raw: unknown) => {
    const node = (raw as Record<string, FsNodeLite> | null)?.[path]
    if (typeof node?.content !== 'string') return null
    try {
      return project(JSON.parse(node.content) as Record<string, unknown>)
    } catch {
      return null
    }
  }
}

/** tasks.json 的标题投影：待办的每条写路径都拿它当「已落库」的屏障 */
const taskTitles = fileDigest(TASKS_PATH, (json) =>
  ((json.tasks ?? []) as { title: string }[]).map((t) => t.title),
)

/** tasks.json 的「标题 + 勾没勾」投影：勾选这条往返的判据在文件里，不在组件的 ref 里 */
const taskFlags = fileDigest(TASKS_PATH, (json) =>
  ((json.tasks ?? []) as { title: string; done: boolean }[]).map((t) => [t.title, t.done]),
)

/* ─────────────────────────── 桌面装配（真实 UI） ─────────────────────────── */

async function openGallery(page: Page): Promise<void> {
  // 右键点选在壁纸空白处（左侧标语与右侧小组件 band 之外），确保命中 Desktop 的右键处理器
  await page.mouse.click(320, 620, { button: 'right' })
  await page.getByRole('button', { name: '添加小组件' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

const cardsOf = (page: Page, kind: Kind): Locator =>
  page.locator(`[data-widget-kind="${kind}"][data-widget-id]`)

/** 卡片上的实例 id 列表：新增前后各取一次，差集就是「这一次真的摆上去了」 */
async function ids(page: Page, kind: Kind): Promise<string[]> {
  return await cardsOf(page, kind).evaluateAll((els) => els.map((el) => el.dataset.widgetId ?? ''))
}

/**
 * 走小组件库把一张卡放上桌面，返回它的实例 id。
 * 选档层的有无不是自由裁量：`WidgetCatalogRow.openChooser()` 按 `sizes.length < 2` 分叉，
 * 单档件（data-summary）点「添加」直接落桌面——两条都要顺手钉住，否则「一种件一行」（A-4）会漂。
 */
async function place(page: Page, kind: Kind, size: WidgetSize): Promise<string> {
  await openGallery(page)
  const before = await ids(page, kind)

  const row = page.locator(`[data-widget-kind-row="${kind}"]`)
  await expect(row).toHaveCount(1)
  await row.getByRole('button', { name: '添加', exact: true }).click()

  const chooser = row.locator('[data-widget-size-chooser]')
  if (KIND_SIZES[kind].length > 1) {
    await expect(
      chooser,
      `${kind} 声明了 ${KIND_SIZES[kind].length} 档 ⇒ 「添加」应开选档层`,
    ).toBeVisible()
    await chooser.getByRole('radio', { name: SIZE_LABEL[size], exact: true }).click()
    await row.getByRole('button', { name: '确定' }).click()
  } else {
    await expect(chooser, `${kind} 只有 1 档 ⇒ 不该出现选档层，点添加即上桌面`).toHaveCount(0)
  }

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // 差集必须恰好一个：多出来是重复落位，一个没有是没画上桌面（溢出的件不进 placed，见 WidgetLayer）。
  // 读取整体失败（dev 服务器偶发的整页重载会打断 evaluate）按「还没画上」计一次，交给轮询重试：
  // 结论仍由「差集恰好 1」在超时内成立，不让基础设施噪声冒充功能失败。
  await expect
    .poll(
      async () => {
        let now: string[]
        try {
          now = await ids(page, kind)
        } catch {
          return -1
        }
        return now.filter((id) => !before.includes(id)).length
      },
      { timeout: 15_000, intervals: [100, 300, 600] },
    )
    .toBe(1)
  const added = (await ids(page, kind)).filter((id) => !before.includes(id))
  return added[0]!
}

/** 渲染态的「这张卡在这个档」：属性（store → DOM）与像素（宿主几何）两路一起钉 */
async function expectCard(page: Page, id: string, kind: Kind, size: WidgetSize): Promise<Locator> {
  const card = page.locator(`[data-widget-id="${id}"]`)
  await expect(card).toHaveCount(1)
  await expect(card).toHaveAttribute('data-widget-kind', kind)
  await expect(card).toHaveAttribute('data-widget-size', size)
  // Suspense 首帧是骨架（aria-busy）：等它退场再量，否则量到的是占位块
  await expect(card.locator('[aria-busy="true"]')).toHaveCount(0)
  const box = await card.boundingBox()
  expect(box, `${kind}·${size} 应出现在桌面`).toBeTruthy()
  expect(Math.round(box!.width), `${kind}·${size} 卡片宽`).toBe(SIZE_PX[size].w)
  expect(Math.round(box!.height), `${kind}·${size} 卡片高`).toBe(SIZE_PX[size].h)
  return card
}

async function reloadShell(page: Page): Promise<void> {
  await page.reload()
  await expect(page.getByRole('banner')).toBeVisible()
}

/** 配置面的两条腿都从小组件中心的实例行就地展开走（§4.12：容器归宿主，抽屉/中心/弹层同一份实现） */
async function openConfigPanel(page: Page, id: string): Promise<Locator> {
  await page.locator(dockTile('小组件中心')).click()
  const win = page.locator('section.absolute').filter({ hasText: '桌面上的小组件' })
  await expect(win).toBeVisible()
  const row = win.locator(`[data-widget-instance-row="${id}"]`)
  await expect(row).toHaveCount(1)
  await row.getByRole('button', { name: '配置', exact: true }).click()
  const panel = row.locator('[data-widget-config-panel]')
  await expect(panel).toBeVisible()
  return panel
}

/* ═══════════════════ 十件 × 放上桌面 → reload ═══════════════════ */

test.describe('T1 持久化往返：每个内置件从小组件库上桌面 → reload → 同实例同档仍在', () => {
  for (const { kind, size, write } of PER_KIND) {
    test(`T1 ${kind}：以非缺省档 ${SIZE_LABEL[size]}（${size}）上桌面 → reload → 同一实例仍是 ${size}（${write}）`, async ({
      page,
    }) => {
      await gotoShell(page)
      const id = await place(page, kind, size)

      await expectCard(page, id, kind, size)
      await expectPersisted(page, WIDGETS_KEY, (raw) => instanceDigest(raw, id), [kind, size])

      await reloadShell(page)
      await expectCard(page, id, kind, size)
    })
  }
})

/* ═════════════ 件数据（VFS）× 自己的写路径 × reload ═════════════ */

test.describe('T1 件数据往返：manifest.data 声明的三件走各自的写路径', () => {
  /**
   * todos 的写路径有两条动作（就地新增、勾选），共享 `/我的数据/tasks.json`（shared 域）。
   * 勾选是历史上最容易漏的一条：§附之一实测「待办勾选第二项 → reload → 未勾」，
   * 当时 `done` 只是组件内 ref。现在它必须落到 tasks.json 才算数——所以判据是文件内容 + reload 后的 DOM，两头都要。
   */
  test('T1 todos：lg 就地新增一条 → reload 仍在；再勾选 → reload 仍勾（写入落在 tasks.json）', async ({
    page,
  }) => {
    const title = '重启园区网关'
    await gotoShell(page)
    const id = await place(page, 'todos', 'lg')
    const card = await expectCard(page, id, 'todos', 'lg')

    const progress = card.getByText(/^完成 \d+\/\d+$/)
    const row = card.locator('li').filter({ hasText: title })
    await card.locator('input[type="text"]').fill(title)
    await card.locator('input[type="text"]').press('Enter')
    await expect(progress).toHaveText('完成 0/1')
    await expect(row).toHaveCount(1)
    await expectPersisted(page, FS_KEY, taskFlags, [[title, false]])

    await reloadShell(page)
    await expect(progress).toHaveText('完成 0/1')
    await expect(row).toHaveCount(1)

    await row.getByRole('checkbox').click()
    await expect(progress).toHaveText('完成 1/1')
    // 勾上的这一行当场消失（showCompleted 缺省 false），所以 DOM 判据只剩主结论
    await expect(row).toHaveCount(0)
    await expectPersisted(page, FS_KEY, taskFlags, [[title, true]])

    await reloadShell(page)
    await expect(progress).toHaveText('完成 1/1')
    await expect(row).toHaveCount(0)
  })

  /**
   * 删除同样是写操作（不是「少了就少了」）：往返判据是「reload 后仍然没有它」＋总数回落。
   * 两条新增之间逐条等落库：本条要证的是删除的往返，不把防抖合并的时序拉进来当判据
   * （连写的合并另有两条腿——单位级 `widget-data-debounce.test.ts` 与下面的动线用例）。
   */
  test('T1 todos：卡内删除一条 → reload 后仍是删后的状态（删除也是写路径）', async ({ page }) => {
    await gotoShell(page)
    const id = await place(page, 'todos', 'lg')
    const card = await expectCard(page, id, 'todos', 'lg')
    const titles = ['留着的这条', '删掉的这条']

    for (let i = 0; i < titles.length; i++) {
      await card.locator('input[type="text"]').fill(titles[i]!)
      await card.locator('input[type="text"]').press('Enter')
      await expectPersisted(page, FS_KEY, taskTitles, titles.slice(0, i + 1))
    }
    await expect(card.getByText(/^完成 \d+\/\d+$/)).toHaveText('完成 0/2')

    await card
      .locator('li')
      .filter({ hasText: titles[1] })
      .getByRole('button', { name: '删除这条待办' })
      .click()
    await expect(card.getByText(/^完成 \d+\/\d+$/)).toHaveText('完成 0/1')
    await expectPersisted(page, FS_KEY, taskTitles, [titles[0]])

    await reloadShell(page)
    await expect(card.getByText(/^完成 \d+\/\d+$/)).toHaveText('完成 0/1')
    await expect(card.locator('li').filter({ hasText: titles[1] })).toHaveCount(0)
    await expect(card.locator('li').filter({ hasText: titles[0] })).toHaveCount(1)
  })

  /**
   * 缺陷已修后的回归腿（原为 fixme 记录实测失点）：连按两次 Enter 落在同一个
   * `DATA_WRITE_DEBOUNCE = 300ms` 窗口里时，第二次写曾以「读不到第一次 pending」的旧底为基，
   * 把第一条待办整条吃掉（实测「完成 0/1」、`/我的数据/tasks.json` 只剩第二条标题）。
   * 修在 `src/kernel/composables/useWidgetData.ts`：防抖窗口内的待落盘值改为按 VFS 路径共享，
   * 于是同一份 shared 数据的多个写者（md/lg 两张卡、「今日」应用）都能逐条累计。
   * 单位级判据在 `tests/unit/widget-data-debounce.test.ts`；这里保留的是**用户动线**那一条——
   * 真实键盘连按、真实文件、reload 后仍在（快速录两条不该只剩最后一条）。
   */
  test('T1 todos：300ms 防抖窗口内连按两次 Enter → 两条都在 → reload 后仍是两条', async ({
    page,
  }) => {
    const titles = ['快录第一条', '快录第二条']
    await gotoShell(page)
    const id = await place(page, 'todos', 'lg')
    const card = await expectCard(page, id, 'todos', 'lg')

    for (const title of titles) {
      await card.locator('input[type="text"]').fill(title)
      await card.locator('input[type="text"]').press('Enter')
    }

    await expect(card.getByText(/^完成 \d+\/\d+$/)).toHaveText('完成 0/2')
    await expectPersisted(page, FS_KEY, taskTitles, titles)
    await reloadShell(page)
    await expect(card.getByText(/^完成 \d+\/\d+$/)).toHaveText('完成 0/2')
  })

  /**
   * 便签只有 lg 可写（sm 首行只读、md 摘要只读），且文件在 instance 域：路径含实例 id。
   * 「输入即保存」的落库同样过 300ms 防抖——库里读到那条 text 才算写成功，之后才敢 reload。
   */
  test('T1 sticky-note：lg textarea 写一句 → reload → textarea 仍是那句（实例域文件）', async ({
    page,
  }) => {
    const text = '记得把网关型号发给实施组'
    await gotoShell(page)
    const id = await place(page, 'sticky-note', 'lg')
    const card = await expectCard(page, id, 'sticky-note', 'lg')

    await card.locator('textarea').fill(text)
    await expect(card.locator('textarea')).toHaveValue(text)
    await expectPersisted(
      page,
      FS_KEY,
      fileDigest(notePath(id), (j) => [j.text ?? null]),
      [text],
    )

    await reloadShell(page)
    await expectCard(page, id, 'sticky-note', 'lg')
    await expect(page.locator(`[data-widget-id="${id}"] textarea`)).toHaveValue(text)
  })

  /**
   * 第三件（calendar）声明的 events.json 没有件内写路径：月历只 `useWidgetData` 读 +
   * `setSelected` 记下选中的日期，日程的新增归「今日」应用（§4.9 批次 A）。
   * 不为它编一条写路径；它的桌面往返在上面那一轮已经覆盖。
   */
})

/* ═════════════════ 配置写路径 × reload ═════════════════ */

test.describe('T1 配置写路径：两种面板表达都过同一条写边界', () => {
  /** clock 声明 configEntry（19 个候选 + 要搜索，schema 表达不了）：自绘面板写的值同样得落库 */
  test('T1 clock：configEntry 自绘面板选第二时区 → reload → lg 卡片仍画出那一城', async ({
    page,
  }) => {
    await gotoShell(page)
    const id = await place(page, 'clock', 'lg')
    const panel = await openConfigPanel(page, id)
    // data-config-entry 在＝这次走的是件自绘的那条表达，不是 schema 缺省渲染器
    await expect(panel.locator('[data-config-entry]')).toHaveCount(1)

    await panel.getByRole('button', { name: '东京', exact: true }).click()
    await panel.getByRole('button', { name: '完成', exact: true }).click()
    await expect(page.locator('[data-widget-config-panel]')).toHaveCount(0)

    await expectPersisted(
      page,
      WIDGETS_KEY,
      (raw) =>
        ((raw ?? []) as PersistedInstance[]).find((i) => i.id === id)?.config?.secondTz ?? null,
      'tokyo',
    )

    await reloadShell(page)
    const card = await expectCard(page, id, 'clock', 'lg')
    // 第二时区那一行只在 lg 且 ianaOf(secondTz) 解得出时画（clock/App.vue）：文字在＝配置回来了
    await expect(card).toContainText('东京')
  })

  /** schema 缺省渲染器（原生 select）那条腿：值同样过 sanitizeConfig，只是表达由宿主画 */
  test('T1 todos：面板把筛选范围改成「全部」→ reload → 卡片仍标着全部', async ({ page }) => {
    await gotoShell(page)
    const id = await place(page, 'todos', 'lg')
    const panel = await openConfigPanel(page, id)
    await expect(panel.locator('[data-config-entry]')).toHaveCount(0)
    const select = panel.locator('select')
    await expect(select).toHaveCount(1)

    await select.selectOption('all')
    await panel.getByRole('button', { name: '完成', exact: true }).click()

    await expectPersisted(
      page,
      WIDGETS_KEY,
      (raw) => ((raw ?? []) as PersistedInstance[]).find((i) => i.id === id)?.config?.scope ?? null,
      'all',
    )

    await reloadShell(page)
    const card = await expectCard(page, id, 'todos', 'lg')
    await expect(card).toContainText('全部')
  })
})

/* ═════════════ 卡内开关：写的不是件数据，是平台状态 ═════════════ */

test('T1 control-center：卡内切「深色」→ reload → 卡片仍标在深色档（写的是 theme-v1，不是件数据）', async ({
  page,
}) => {
  await gotoShell(page)
  const id = await place(page, 'control-center', 'lg')
  const card = await expectCard(page, id, 'control-center', 'lg')

  const dark = card.getByRole('button', { name: '深色', exact: true })
  await expect(dark).toHaveAttribute('aria-pressed', 'false')
  await dark.click()
  // 开关当场改写根属性：这是「卡内开关即平台动作」的即时证据，reload 之后要还能看见同一个值
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(card.getByRole('button', { name: '深色', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expectPersisted(
    page,
    THEME_KEY,
    (raw) => (raw as { mode?: string } | null)?.mode ?? null,
    'dark',
  )

  await reloadShell(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const again = await expectCard(page, id, 'control-center', 'lg')
  await expect(again.getByRole('button', { name: '深色', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})
