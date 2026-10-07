import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page, type Locator } from '@playwright/test'
import { gotoShell } from './helpers'

/**
 * §9 验收表的 e2e 腿 + §4.3 契约的 A-9 腿（docs/WebOS小组件功能设计.md）：
 *   T1 持久化往返——每个写操作 → reload → 状态仍在（§4.2 的三条写通道）
 *   T2 死白率——每件 × 每档，内容包围盒对卡片内框，连续死白 ≤15%（§2.2 E3 / §附之一的测法）
 *   T3 对比度 + 文字地板——件内文字 ≥11px、三档墨色对卡片底 ≥AA 正文，两套主题 × 三壁纸（§4.6）
 *   T4 键盘路径 + 命中区——§4.5 / S-6 / L-6 的键盘等价物与 R4 的 24×24 地板
 *   A-9 「上次更新时间」——§4.3 有契约但 §9 没有腿：数据型件每档恰有一条读数
 *
 * 桌面件的权威状态是 IndexedDB 里的 `widgets-v1`（`src/kernel/stores/widgets.ts`）。
 * 这里一律「先写库 → reload」，让件走 restoreInstances 的真实还原路径上桌面，
 * 于是「manifest 声明了哪些档」被 `data-widget-size` 反向核对——加了档没更新本表就会红。
 * 全程不 sleep：落库是 fire-and-forget，reload 前先把库读到期望值（expectPersisted）。
 */

type WidgetSize = 'sm' | 'md' | 'lg'

/** 十件 × 各自 manifest.widget.sizes 的档位 */
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

const KINDS = Object.keys(KIND_SIZES) as (keyof typeof KIND_SIZES)[]

/**
 * 展示型四件（§4.9：件内不放任何控件，鼠标目标是整块卡片）：对它们「量到 0 个可交互目标」
 * 是设计而不是取样失败，所以 T4 的取样守卫按这一名单分岔——它必须落在**声明**上，
 * 不能落在「这次量到了几个」上，否则守卫就成了跟着测量结果走的空话。
 * 2026-10-07 前这四个 kind 的 `> 0` 守卫一直靠卡片表面那颗宿主自绘的「移除」浮标恒真满足，
 * 也就是说它从来没有守过件内取样（浮标摘掉后当场暴露，见 §8 偏差 29）。
 */
const DISPLAY_ONLY_KINDS = ['clock', 'storage', 'system', 'data-summary'] as const

/** geometry.ts 的档位像素（CELL 68 / GUTTER 24）：卡片尺寸断言用 */
const SIZE_PX: Record<WidgetSize, { w: number; h: number }> = {
  sm: { w: 160, h: 160 },
  md: { w: 344, h: 160 },
  lg: { w: 344, h: 344 },
}
/** 一格 = CELL、相邻格恒夹 GUTTER（G-1/L-4）⇒ 挪一格与换一行的像素步长 */
const PITCH = 68 + 24

const MODES = ['light', 'dark'] as const
/** = theme.ts 的 WALLPAPER_KEYS（顺序一致） */
const WALLPAPERS = ['wallpaper-sky', 'wallpaper-dusk', 'wallpaper-jade'] as const

const WIDGETS_KEY = 'widgets-v1'
const THEME_KEY = 'theme-v1'
/** = `src/kernel/stores/vfs.ts` 的 FS_KEY：件数据（tasks/events/便签）都落在这棵树里 */
const FS_KEY = 'fs-v1'

/** §4.6 / HIG H-2：件内文字地板 11px；三档墨色对卡片底按 §4.6 自陈的 AA 正文 4.5 判 */
const FONT_FLOOR = 11
const AA_BODY = 4.5
/** §9 T2 的地板 */
const DEAD_LIMIT = 15
/** R4 命中区地板（S-5 是拖角手柄的显形规则，随浮标一并作废，见 §8 偏差 29） */
const TARGET_MIN = 24
/**
 * (HIG) A-9「更新频率跟不上查看频率时，显示上次更新时间」的适用面（§4.3 末段）：
 * 只落在**数据源独立于观看者**的件上——浏览器 API（storage/system）、别的应用的写入
 * （notification-summary）、外部 fixture（data-summary）。
 * 其余件不豁免得含糊：`clock` 内容即时间本身；`calendar`/`todos`/`sticky-note`/`control-center`
 * 的变更就是用户自己的动作（`refresh: 'manual'` 或即时生效），永远最新；
 * `recent-files` 每条自带行级相对时间，比一条卡片级汇总更贴（同类信息不重复两处）。
 * 这张表就是它的机器腿：该有一处且只有一处，不该有的一个都不许冒出来。
 */
const A9_KINDS: readonly string[] = ['storage', 'system', 'notification-summary', 'data-summary']

interface Combo {
  kind: keyof typeof KIND_SIZES
  size: WidgetSize
  /**
   * 实例配置：默认不填（走 schema 缺省），只给「最差那一档配置」的用例显式传。
   * 行数上限是由 config 决定的（todos `limit` 3–8、recent-files `count` 4–8），
   * 缺省态量不到上界，所以要把上界量成一条腿（见 T4 最差配置腿）。
   */
  config?: Record<string, unknown>
}

interface SeedItem {
  id: string
  kindId: string
  size: WidgetSize
  pos: { col: number; row: number } | null
  addedAt: number
  config?: Record<string, unknown>
}

const combosOf = (kind: keyof typeof KIND_SIZES): Combo[] =>
  KIND_SIZES[kind].map((size) => ({ kind, size }))

const cardOf = (page: Page, combo: Combo): Locator =>
  page.locator(`[data-widget-kind="${combo.kind}"][data-widget-size="${combo.size}"]`)

/** 窗口体与卡片同为 `section.absolute`，靠 rounded-panel 一档区分（WindowFrame.vue 独有） */
const windowOf = (page: Page, title: string): Locator =>
  page.locator('section.rounded-panel').filter({ hasText: title })

/* ─────────────────────────── 桌面装配（IDB 播种） ─────────────────────────── */

function seedItems(combos: Combo[]): SeedItem[] {
  return combos.map((c, i) => ({
    id: `wgt-${c.kind}-${c.size}`,
    kindId: c.kind,
    size: c.size,
    // pos=null ⇒ 走自动流式（L-5 缺省态），落位交给 placeWidgets()
    pos: null,
    addedAt: i + 1,
    ...(c.config ? { config: c.config } : {}),
  }))
}

function seedTheme(theme: { mode?: (typeof MODES)[number]; wallpaper?: string }) {
  return {
    version: 2,
    wallpaper: theme.wallpaper ?? WALLPAPERS[0],
    mode: theme.mode ?? 'light',
    accent: 'sky',
  }
}

const isoDay = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * 播种的待办正文。给 9 条而不是刚够看的条数：lg 的行预算上界是 `config.limit` 的 8
 * （schema `max` 与 App.vue 的 clamp 双重封顶），只有正文多于 8 才既走得到「8 行清单」
 * 又走得到那行「还有 N 项」（R3 的计数出口）——上界那一屏是量命中区与内框的地方。
 * T1 的三条 todos 用例的期望数组也从这一个源头推，别再手抄一份（改种子时抄漏就是那 4 条红）。
 */
const SEEDED_TASK_TITLES = [
  '整理园区巡检记录',
  '与设计约方案评审',
  '回复合同附件',
  '更新周报数据',
  '核对考勤异常',
  '跟进供应商发票',
  '补全发布检查清单',
  '整理评审遗留问题',
  '确认下季度排期',
]

/**
 * 件的数据来自 VFS `/我的数据/…`（§4.2），首启时 `useWidgetData` 只落 factory 默认值——
 * 对 待办/月历/便签 那就是空文件，量到的死白其实是**空态**的死白。
 * 这里按 taskSchedule 的数据契约把内容补齐，让 T2 量的是「设计好的那一屏」；
 * 空态读数另列（本轮跑出来的那批数字进最终报告）。
 */
/**
 * 播种的可选旋钮。**默认全关**：打开任何一个都会改变「每一屏长什么样」，而 T2/T3/T4 那批判据
 * 量的就是默认那一屏（死白比例、字号地板、命中区）——所以只有需要到达某一态的腿才带参数。
 * 这类态的可达性是判据的一部分：`eventsOn: 'other'` 之于月历农历行、`doneTasks` 之于
 * `showCompleted=true`、`offScopeTasks` 之于 `scope=all`、`recentFiles` 之于 `count` 的上界。
 */
interface SeedOptions {
  eventsOn?: 'today' | 'other'
  /** 额外播种 N 个 `/我的文件/*.md`：首启工厂只给 4 个文件，`count` 的上界 8 那一屏要数得到行数 */
  recentFiles?: number
  /** 把播种待办的**最后** N 条标为已完成（`showCompleted` 的 true 侧要有东西可显示） */
  doneTasks?: number
  /** 再加 N 条**逾期**（due = 今天 − 5 天）待办：缺省 `scope: 'today'` 不该画出它们，`scope: 'all'` 该画，
   *  且因 `sortTasks` 按 due 升序排，它们会顶到清单最前——不然落在 slice 之外就测不出筛选 */
  overdueTasks?: number
}

function dataNodes(combos: Combo[], options: SeedOptions = {}): Record<string, unknown> {
  const today = isoDay(new Date())
  // 月历的议程只认「今天」那一格（calendar/App.vue 的 agenda 按 todayIso 过滤），
  // 所以要把议程掏空只能把事件挪到别的日子——这是 §4.9 农历那态唯一的到达路径。
  const eventDay = options.eventsOn === 'other' ? isoDay(new Date(Date.now() + 86_400_000)) : today
  const node = (path: string, content: string) => ({
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    type: 'file',
    size: new TextEncoder().encode(content).length,
    updatedAt: Date.now(),
    mime: 'application/json',
    content,
  })
  const doneCount = options.doneTasks ?? 0
  const nodes: Record<string, unknown> = {
    '/我的数据': {
      path: '/我的数据',
      name: '我的数据',
      type: 'dir',
      size: 0,
      updatedAt: Date.now(),
    },
    // 待办的行预算：md 3 条 +「还有 N 项」，lg 按 config.limit 最多 8 条 + 同一行计数出口。
    // 条数见 SEEDED_TASK_TITLES——多给的那几条不是凑饱满，是让 lg 的**上界那一屏**量得到。
    '/我的数据/tasks.json': node(
      '/我的数据/tasks.json',
      JSON.stringify({
        version: 1,
        tasks: [
          ...SEEDED_TASK_TITLES.map((title, i) => ({
            id: `a${i + 1}`,
            title,
            // 标在最后几条：前几条仍是未完成，md/lg 的缺省那一屏不被这个旋钮动到
            done: i >= SEEDED_TASK_TITLES.length - doneCount,
            due: today,
            createdAt: i + 1,
          })),
          ...Array.from({ length: options.overdueTasks ?? 0 }, (_, i) => ({
            id: `x${i + 1}`,
            title: `逾期事项 ${i + 1}`,
            done: false,
            due: isoDay(new Date(Date.now() - (5 - i) * 86_400_000)),
            createdAt: 500 + i,
          })),
        ],
      }),
    ),
    // 月历 lg 的议程区只认「今天」的事件（calendar/App.vue agenda）。
    // 给 4 条而不是 3 条：议程的行预算是 3（agendaShown）+「还有 N 项」（agendaRest），
    // 少一条就不会出现那一行，R3 的计数出口与它占的那 22px 高度都不在量测范围内——
    // 而月历 lg 的日格高度正是从「内框 − 标题 − 表头 − 议程」倒推出来的（见 T4 最差形态那条腿）。
    '/我的数据/events.json': node(
      '/我的数据/events.json',
      JSON.stringify({
        version: 1,
        events: [
          { id: 'e1', title: '产品方案评审', date: eventDay, start: '09:30' },
          { id: 'e2', title: '客户巡场', date: eventDay, start: '14:00' },
          { id: 'e3', title: '周会同步', date: eventDay, start: '16:30' },
          { id: 'e4', title: '安全巡检复盘', date: eventDay, start: '19:00' },
        ],
      }),
    ),
    '/我的数据/sticky-note': {
      path: '/我的数据/sticky-note',
      name: 'sticky-note',
      type: 'dir',
      size: 0,
      updatedAt: Date.now(),
    },
  }
  // 便签是 instance 域（widgetData.ts）：路径含实例 id，逐实例播种
  for (const c of combos.filter((x) => x.kind === 'sticky-note')) {
    nodes[`/我的数据/sticky-note/wgt-${c.kind}-${c.size}.json`] = node(
      `/我的数据/sticky-note/wgt-${c.kind}-${c.size}.json`,
      JSON.stringify({ text: '水电费 renewal 记得周三前提交，顺带确认巡检排班表' }),
    )
  }
  // 最近文件的候选面：首启工厂只给 4 个文件，`count` 的 schema 上界是 8——不补种就只能量到下界
  for (let i = 0; i < (options.recentFiles ?? 0); i++) {
    const path = `/我的文件/巡检记录${i + 1}.md`
    nodes[path] = node(path, `seed recent file ${i + 1}`)
  }
  return nodes
}

/** 读-改-写 fs-v1：不能整库覆盖，否则首启播种的 /我的文件 树（recent-files、存储件都要）就没了 */
async function mergeFs(page: Page, extra: Record<string, unknown>): Promise<void> {
  await page.evaluate(
    async ([key, nodes]: [string, Record<string, unknown>]) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('webos', 1)
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv')
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      try {
        const current = await new Promise<Record<string, unknown>>((resolve, reject) => {
          const req = db.transaction('kv').objectStore('kv').get(key)
          req.onsuccess = () => resolve((req.result as Record<string, unknown>) ?? {})
          req.onerror = () => reject(req.error)
        })
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('kv', 'readwrite')
          tx.objectStore('kv').put({ ...current, ...nodes }, key)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
      } finally {
        db.close()
      }
    },
    [FS_KEY, extra] as [string, Record<string, unknown>],
  )
}

async function writeKv(page: Page, entries: Record<string, unknown>): Promise<void> {
  await page.evaluate(async (list: [string, unknown][]) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('webos', 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite')
        const store = tx.objectStore('kv')
        for (const [key, value] of list) store.put(JSON.parse(JSON.stringify(value)) as never, key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
    } finally {
      db.close()
    }
  }, Object.entries(entries))
}

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

/**
 * 播种→reload 的读回要放在 **reload 之后**复核，不能只信 reload 之前那一次：
 * 冷启的 `seedDefaults()` 与 `useWidgetData` 补默认值都是 fire-and-forget 的整树刷盘，
 * 它们可能落在我们「读回＝一致」之后才把 fs-v1 盖回去——于是 reload 起来的是**空数据**的桌面，
 * 卡片照常渲染（`[data-widget-kind]` 计数照过），件内却没有列表项，测试表现为一句 30s 超时
 * （实测偶发于两 worker 并发时；单跑必绿）。
 * 复核不匹配就再播一次并再 reload：第二次 boot 时文件已在库里，补默认值那条路不再触发。
 */
async function mount(
  page: Page,
  combos: Combo[],
  theme: { mode?: (typeof MODES)[number]; wallpaper?: string } = {},
  data: SeedOptions = {},
): Promise<void> {
  const items = seedItems(combos)
  const themeVal = seedTheme(theme)
  const fs = dataNodes(combos, data)
  const digest = (fsNodes: Record<string, unknown> | undefined) =>
    JSON.stringify([
      items,
      themeVal,
      // 只比对播种的那几个节点：别的树节点随首启而变，不参与判定
      Object.fromEntries(
        Object.keys(fs).map((path) => [
          path,
          fsNodes?.[path] ? JSON.stringify(fsNodes[path]) : null,
        ]),
      ),
    ])
  const wanted = digest(fs)
  await gotoShell(page)

  for (let attempt = 1; ; attempt++) {
    await expect
      .poll(
        async () => {
          await writeKv(page, { [WIDGETS_KEY]: items, [THEME_KEY]: themeVal })
          await mergeFs(page, fs)
          const back = await readKv(page, [WIDGETS_KEY, THEME_KEY, FS_KEY])
          return digest(back[FS_KEY] as Record<string, unknown> | undefined)
        },
        { timeout: 10_000, intervals: [100, 300, 600] },
      )
      .toBe(wanted)

    await page.reload()
    await expect(page.getByRole('banner')).toBeVisible()
    // theme store 应按播种值落根属性（三壁纸/两主题的变量入口就是它）
    await expect(page.locator('html')).toHaveAttribute('data-theme', themeVal.mode!)
    await expect(page.locator('html')).toHaveAttribute('data-accent', themeVal.accent)
    await expect(page.locator('[data-widget-kind]')).toHaveCount(combos.length)

    const booted = await readKv(page, [FS_KEY])
    const got = digest(booted[FS_KEY] as Record<string, unknown> | undefined)
    if (got === wanted) break
    expect(
      attempt,
      `播种的 fs-v1 节点在 boot 之后被应用自己的刷盘盖掉了（第 ${attempt} 次）：` +
        `期望 ${wanted.slice(0, 160)}…，实得 ${got.slice(0, 160)}…`,
    ).toBeLessThan(3)
  }

  for (const combo of combos) {
    const card = cardOf(page, combo)
    // restoreInstances 把 manifest 没声明的档收敛到 defaultSize：对不上就是档位表与代码漂移
    await expect(card, `${combo.kind} 应以声明过的 ${combo.size} 档渲染`).toHaveAttribute(
      'data-widget-size',
      combo.size,
    )
    // Suspense 首帧是骨架（aria-busy）；等它退场再量，否则量到占位块
    await expect(card.locator('[aria-busy="true"]')).toHaveCount(0)
    const box = await card.boundingBox()
    expect(box, `${combo.kind}·${combo.size} 应出现在桌面`).toBeTruthy()
    expect(Math.round(box!.width), `${combo.kind}·${combo.size} 卡片宽`).toBe(SIZE_PX[combo.size].w)
    expect(Math.round(box!.height), `${combo.kind}·${combo.size} 卡片高`).toBe(
      SIZE_PX[combo.size].h,
    )
  }
}

/** 写库是 fire-and-forget：reload 之前先把库读到期望值（也是 T13「落库的是 {col,row}」） */
async function expectPersisted(
  page: Page,
  pick: (items: SeedItem[]) => unknown,
  expected: unknown,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const back = await readKv(page, [WIDGETS_KEY])
        const items = (back[WIDGETS_KEY] ?? null) as SeedItem[] | null
        return JSON.stringify(items ? pick(items) : null)
      },
      { timeout: 10_000, intervals: [100, 300, 600] },
    )
    .toBe(JSON.stringify(expected))
}

/**
 * 主题不走「运行中改 data-theme」：件内的 chip 带 `transition duration-quick`，翻根属性那一刻
 * 量到的是过渡中间色（实测浅色墨 #334155 压在深色卡底上「1.4:1」，是假阳性）。
 * 一律按 theme-v1 播种后 reload，让 theme store 自己落 data-theme——也是 §4.6「表面与主题同层」
 * 的真实装配路径。播种档位与根属性对不上即为漂移。
 */

/* ─────────────────────────── 浏览器侧探针 ─────────────────────────── */

interface LeafReading {
  tag: string
  text: string
  fontSize: number
  color: string
  /** 该元素墨色对卡片底（token 层）的对比度 */
  ratio: number
  top: number
  bottom: number
  left: number
  right: number
  anchored: 'top' | 'bottom' | 'center' | 'none'
}

interface TargetReading {
  label: string
  w: number
  h: number
}

interface TokenReading {
  surface: string
  solid: string
  ink: string
  inkMute: string
  inkDisabled: string
}

interface CardReading {
  kind: string
  size: WidgetSize
  /** 卡片内框（扣掉宿主给的内边距），§9 T2 的分母 */
  inner: { w: number; h: number }
  /** 卡片自己的 computed background-color：§4.6 要求它就是 surface token，不是壁纸玻璃 */
  bg: string
  /** 本档主题的小组件表面/墨色 token 原值（换壁纸不该动它一个字） */
  tokens: TokenReading
  /** 内容流末端的连续空白带 / 内框高（§附之一口径） */
  bottomDead: number
  topDead: number
  /** 内容块整块居中时空白分落两头：上下两条带之和（＝1 − 内容包围盒/内框高） */
  slack: number
  /**
   * §9 T2 真正判的那条「连续死白」：流式内容取末端那一条空白带；
   * 整块居中的内容没有尾带，空白是被设计对称分掉的（§4.4 R1 的 sm 预算就是「一个数字 + 一行标签」，
   * 按字面「包围盒/内框 ≥85%」任何 sm 都不可达），于是只罚居中也没解释掉的不对称余量。
   */
  flowDead: number
  /** 内容块在内框里的锚定方式，用来解释 flowDead 取的是哪一条 */
  anchor: 'top' | 'bottom' | 'center'
  /** 内容包围盒宽 / 内框宽（E3 给时钟 md 的那条横向读数） */
  widthUsed: number
  /**
   * 内容包围盒越出内框的像素。卡片是 `overflow-hidden`（§4.6 材质），越出去的部分被**静默裁掉**：
   * 死白腿只罚「太空」，裁切发生在反方向，所以今天没有任何腿在管它。A-9 的「更新于」行要占
   * 一行流式高度，正是最容易把某档推出内框的动作——先补这条腿，改预算才有判据可依。
   */
  spill: { top: number; bottom: number; left: number; right: number }
  /** 内容包围盒高 / 内框高（与 slack 互补，读的是同一条带） */
  used: number
  /**
   * (HIG) A-9 的「上次更新时间」读数（`[data-widget-updated]` 的文本，按文档顺序）。
   * 只数节点不判内容：文本走 `Intl.RelativeTimeFormat`，跑测试的那一刻是「刚刚」还是「5 分钟前」
   * 取决于播种数据与 locale，内容断言会变成 flaky；**有没有这一条、是不是只有一条**才是契约。
   */
  updated: string[]
  leaves: LeafReading[]
  targets: TargetReading[]
}

/**
 * 一次往返取齐三条腿的读数（死白带 / 文字地板与墨色 / 命中区）。
 * 对比度按 §4.6 在 token 层算：卡片是 `backdrop-blur` 之上的半透明玻璃，DOM 读不到它与壁纸的
 * 混合色——穿透壁纸就测不出 token 漂移，所以用 surface 叠它自己的不透明代表色 solid。
 */
function probe(): CardReading[] {
  const num = (v: string) => parseFloat(v) || 0
  const parse = (css: string) => {
    const ctx = new OffscreenCanvas(1, 1).getContext('2d')
    if (!ctx) return { r: 0, g: 0, b: 0, a: 1 }
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = css
    ctx.fillRect(0, 0, 1, 1)
    const d = ctx.getImageData(0, 0, 1, 1).data
    return { r: d[0] / 255, g: d[1] / 255, b: d[2] / 255, a: d[3] / 255 }
  }
  const lum = (c: { r: number; g: number; b: number }) => {
    const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  type Rgba = { r: number; g: number; b: number; a: number }
  const over = (fg: Rgba, bg: Rgba): Rgba =>
    fg.a >= 1
      ? fg
      : {
          r: fg.r * fg.a + bg.r * (1 - fg.a),
          g: fg.g * fg.a + bg.g * (1 - fg.a),
          b: fg.b * fg.a + bg.b * (1 - fg.a),
          a: 1,
        }
  const ratioOf = (fgCss: string, bg: Rgba) => {
    const l1 = lum(over(parse(fgCss), bg))
    const l2 = lum(bg)
    return Number(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2))
  }

  const root = getComputedStyle(document.documentElement)
  const varOf = (name: string) => root.getPropertyValue(name).trim()
  const tokens: TokenReading = {
    surface: varOf('--raw-widget-surface'),
    solid: varOf('--raw-widget-surface-solid'),
    ink: varOf('--color-widget-ink'),
    inkMute: varOf('--color-widget-ink-mute'),
    inkDisabled: varOf('--color-widget-ink-disabled'),
  }
  const surface = parse(tokens.surface)
  const effective = over(surface, parse(tokens.solid))

  const ATOMIC = new Set(['svg', 'img', 'canvas', 'video', 'input', 'textarea', 'select'])
  const INTERACTIVE =
    'button, input, textarea, select, a, [role="checkbox"], [role="button"], [data-widget-interactive]'

  return Array.from(document.querySelectorAll<HTMLElement>('[data-widget-kind]')).map((card) => {
    const content = card.querySelector<HTMLElement>('[data-widget-content]')!
    const pad = getComputedStyle(content)
    const box = content.getBoundingClientRect()
    const inner = {
      top: box.top + num(pad.paddingTop),
      right: box.right - num(pad.paddingRight),
      bottom: box.bottom - num(pad.paddingBottom),
      left: box.left + num(pad.paddingLeft),
    }
    const innerH = Math.max(1, inner.bottom - inner.top)
    const innerW = Math.max(1, inner.right - inner.left)

    const leaves: LeafReading[] = []
    for (const el of Array.from(content.querySelectorAll<HTMLElement>('*'))) {
      const st = getComputedStyle(el)
      // 绝对定位的是件内贴角元素（角标一类），不属于件内内容流
      if (st.position === 'absolute' || st.position === 'fixed') continue
      if (el.closest('[aria-hidden="true"]')) continue
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) continue
      const hasOwnText = Array.from(el.childNodes).some(
        (n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '',
      )
      // 只认「内容叶」：自带文字的元素 + 原子元素。撑满内框的包裹层（flex/h-full）不算内容
      if (!hasOwnText && !ATOMIC.has(el.tagName.toLowerCase())) continue
      leaves.push({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 24),
        fontSize: Number(parseFloat(st.fontSize).toFixed(2)),
        color: st.color,
        ratio: ratioOf(st.color, effective),
        top: Number(r.top.toFixed(1)),
        bottom: Number(r.bottom.toFixed(1)),
        left: Number(r.left.toFixed(1)),
        right: Number(r.right.toFixed(1)),
        anchored: 'none',
      })
    }

    const contentTop = leaves.length ? Math.min(...leaves.map((l) => l.top)) : inner.top
    const contentBottom = leaves.length ? Math.max(...leaves.map((l) => l.bottom)) : inner.bottom
    const contentLeft = leaves.length ? Math.min(...leaves.map((l) => l.left)) : inner.left
    const contentRight = leaves.length ? Math.max(...leaves.map((l) => l.right)) : inner.left
    const topGap = Math.max(0, contentTop - inner.top)
    const bottomGap = Math.max(0, inner.bottom - contentBottom)
    // 判定内容块是「从顶上流下来 / 贴底上来」还是「整块居中」：决定连续死白该按哪条边读
    const anchor: CardReading['anchor'] = topGap <= 4 ? 'top' : bottomGap <= 4 ? 'bottom' : 'center'
    for (const l of leaves) {
      l.anchored = anchor
    }

    // 只排掉「根本不在布局里」的目标（display:none / visibility:hidden 的可交互元素不是用户目标）。
    // 以前这里排的是 `w>0 && h>0`：一个被压成 0 高（或 0 宽）但仍在布局里的按钮会被静默排掉，
    // 等于给地板开了张隐形豁免表——而 T4 的口径是「没有豁免表」（地板就是地板，见下面的裁决）。
    const targets: TargetReading[] = Array.from(card.querySelectorAll<HTMLElement>(INTERACTIVE))
      .filter(
        (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden',
      )
      .map((el) => {
        const r = el.getBoundingClientRect()
        const label =
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 18) ||
          el.tagName.toLowerCase()
        return {
          label,
          w: Number(r.width.toFixed(1)),
          h: Number(r.height.toFixed(1)),
        }
      })

    const pct = (px: number, base: number) => Number(((px / base) * 100).toFixed(1))
    const bottomDead = pct(bottomGap, innerH)
    const topDead = pct(topGap, innerH)
    const flowDead =
      anchor === 'center'
        ? Number(Math.abs(bottomDead - topDead).toFixed(1))
        : Number(Math.max(bottomDead, topDead).toFixed(1))
    return {
      kind: card.dataset.widgetKind!,
      size: card.dataset.widgetSize as WidgetSize,
      inner: { w: Number(innerW.toFixed(1)), h: Number(innerH.toFixed(1)) },
      bg: getComputedStyle(card).backgroundColor,
      tokens,
      bottomDead,
      topDead,
      slack: pct(topGap + bottomGap, innerH),
      flowDead,
      anchor,
      widthUsed: pct(contentRight - contentLeft, innerW),
      used: pct(contentBottom - contentTop, innerH),
      spill: {
        top: Number(Math.max(0, inner.top - contentTop).toFixed(1)),
        bottom: Number(Math.max(0, contentBottom - inner.bottom).toFixed(1)),
        left: Number(Math.max(0, inner.left - contentLeft).toFixed(1)),
        right: Number(Math.max(0, contentRight - inner.right).toFixed(1)),
      },
      updated: Array.from(card.querySelectorAll<HTMLElement>('[data-widget-updated]')).map((el) =>
        (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
      ),
      leaves,
      targets,
    }
  })
}

const readCards = (page: Page): Promise<CardReading[]> => page.evaluate(probe)

/**
 * token 层三档墨色对卡片底的对比度（§4.6 自陈的 AA 正文 4.5）。
 * 与 probe 同一套算术，但要的是「token 本身」的读数：DOM 上的元素可能自带别的色，
 * token 漂了却不被发现，是 §4.6 最坏的那种回归。自包含：整条函数被序列化进浏览器。
 */
function inkRatios(tokens: TokenReading): Record<'ink' | 'inkMute' | 'inkDisabled', number> {
  const parse = (css: string) => {
    const ctx = new OffscreenCanvas(1, 1).getContext('2d')!
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = css
    ctx.fillRect(0, 0, 1, 1)
    const d = ctx.getImageData(0, 0, 1, 1).data
    return { r: d[0] / 255, g: d[1] / 255, b: d[2] / 255, a: d[3] / 255 }
  }
  const lum = (c: { r: number; g: number; b: number }) => {
    const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  type Rgba = { r: number; g: number; b: number; a: number }
  const over = (fg: Rgba, bg: Rgba): Rgba =>
    fg.a >= 1
      ? fg
      : {
          r: fg.r * fg.a + bg.r * (1 - fg.a),
          g: fg.g * fg.a + bg.g * (1 - fg.a),
          b: fg.b * fg.a + bg.b * (1 - fg.a),
          a: 1,
        }
  const bg = over(parse(tokens.surface), parse(tokens.solid))
  const l2 = lum(bg)
  const out = {} as Record<'ink' | 'inkMute' | 'inkDisabled', number>
  for (const key of ['ink', 'inkMute', 'inkDisabled'] as const) {
    const l1 = lum(over(parse(tokens[key]), bg))
    out[key] = Number(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2))
  }
  return out
}

/** 该件各档位的死白读数摊成一行一个，失败时直接对着表判 */
/** 四向越框像素之和：这条腿的判据（0＝内容整块落在内框里） */
function spillPx(r: CardReading): number {
  return Number((r.spill.top + r.spill.bottom + r.spill.left + r.spill.right).toFixed(1))
}

/** 「越框」列的读数：无越框时写「无」，有则按方向列出像素 */
function spillText(r: CardReading): string {
  const dirs = (['top', 'bottom', 'left', 'right'] as const)
    .filter((k) => r.spill[k] > 0)
    .map((k) => `${k} ${r.spill[k]}px`)
  return dirs.length ? dirs.join(' ') : '无'
}

/** A-9 读数摊成一行一档，失败时能直接看出是「没有」还是「落了两处」 */
function updatedTable(rows: CardReading[]): string {
  return [
    '\n「更新于」读数:',
    ...rows.map(
      (r) => `  ${r.kind}·${r.size}：${r.updated.length} 条 → ${r.updated.join(' | ') || '无'}`,
    ),
  ].join('\n')
}

function deadTable(rows: CardReading[]): string {
  const sorted = [...rows].sort((a, b) => b.flowDead - a.flowDead)
  const spilled = rows.filter((r) => spillPx(r) > 0)
  return [
    '\n死白读数（占内框高 %：flow＝判据用的连续死白带，bottom/top＝两条边的空白带，' +
      'slack＝1 − 内容包围盒/内框（字面口径的死白），used＝内容包围盒/内框，宽占用＝内容包围盒宽/内框宽）:',
    ...sorted.map(
      (r) =>
        `  ${r.kind}·${r.size} 内框 ${r.inner.w}×${r.inner.h} [${r.anchor}] flow ${r.flowDead}%  ` +
        `bottom ${r.bottomDead}%  top ${r.topDead}%  slack ${r.slack}%  used ${r.used}%  ` +
        `宽占用 ${r.widthUsed}%  越框 ${spillPx(r)}px（${spillText(r)}）`,
    ),
    ...(spilled.length
      ? [
          '不达标（内容被 overflow-hidden 裁掉）:',
          ...spilled.map((r) => `  ✗ ${r.kind}·${r.size} 越出 ${spillPx(r)}px：${spillText(r)}`),
        ]
      : []),
  ].join('\n')
}

/** 命中区读数：每档摊出最小的那几个目标（不达标的那张表也用它，因为口径一致） */
function targetTable(rows: CardReading[]): string {
  const lines = rows.map((r) => {
    const sorted = [...r.targets].sort((a, b) => Math.min(a.w, a.h) - Math.min(b.w, b.h))
    const worst = sorted
      .slice(0, 3)
      .map((t) => `${t.label} ${t.w}×${t.h}`)
      .join('，')
    return `  ${r.kind}·${r.size}：${r.targets.length} 个可交互目标，最小 ${worst || '无'}`
  })
  const bad = rows.flatMap((r) =>
    r.targets
      .filter((t) => t.w < TARGET_MIN || t.h < TARGET_MIN)
      .map((t) => `  ✗ ${r.kind}·${r.size}: ${t.label} → ${t.w}×${t.h}`),
  )
  return [
    `\n命中区读数（地板 ${TARGET_MIN}×${TARGET_MIN}）:`,
    ...lines,
    ...(bad.length ? ['不达标:', ...bad] : []),
  ].join('\n')
}

/** 文字地板 + 墨色读数：只摊最差的几个，月历有 42 个格子，全摊反而看不出问题 */
function fontTable(rows: CardReading[], mode: string): string {
  const leaves = rows.flatMap((r) => r.leaves.map((l) => ({ ...l, kind: r.kind, size: r.size })))
  const byFont = [...leaves].sort((a, b) => a.fontSize - b.fontSize).slice(0, 6)
  const byRatio = [...leaves].sort((a, b) => a.ratio - b.ratio).slice(0, 6)
  const row = (l: (typeof leaves)[number]) =>
    `  ${l.kind}·${l.size} <${l.tag}>「${l.text}」 ${l.fontSize}px ${l.color} → ${l.ratio}:1`
  return [
    `\n文字读数（${mode}，各档最差六个）:`,
    '最小字号:',
    ...byFont.map(row),
    `最低对比度（对卡片底，token 层）:`,
    ...byRatio.map(row),
  ].join('\n')
}

/** 把每条腿的实测读数记进用例注解：过了也留痕（`--reporter=json` 可取回），红了直接对着判 */
function note(description: string): void {
  test.info().annotations.push({ type: 'measured', description })
}

/* ═══════════════════════ T1 持久化往返 ═══════════════════════ */

/** fs-v1 里某个路径的正文；节点不存在返回 null */
const fsNodeContent = (kv: Record<string, unknown>, path: string): string | null => {
  const tree = kv[FS_KEY] as Record<string, { content?: string }> | undefined
  return tree?.[path]?.content ?? null
}

/** 落库全是 fire-and-forget：先 poll 库到期望形状，再 reload——所以腿里没有 sleep */
async function persistThenReload(
  page: Page,
  read: (kv: Record<string, unknown>) => unknown,
  expected: unknown,
): Promise<void> {
  await expect
    .poll(
      async () =>
        JSON.stringify(read(await readKv(page, [FS_KEY, WIDGETS_KEY, THEME_KEY])) ?? null),
      { timeout: 15_000, intervals: [100, 300, 600] },
    )
    .toBe(JSON.stringify(expected))
  await page.reload()
  await expect(page.getByRole('banner')).toBeVisible()
}

/**
 * §9 T1：每个写操作 → reload → 状态仍在。
 *
 * 九件实测只有三条写通道，本表逐条走一遍：
 *   ① 件数据（`useWidgetData.write` → VFS `/我的数据/…`）——待办的勾/增/删、便签的正文
 *   ② 平台状态（theme / settings store）——控制中心的主题、强调色、壁纸、语言、Dock 重置
 *   ③ 实例配置（宿主面板 → `widgets-v1`）——机制单一且逐件同码，已由 widget.spec.ts 的
 *     「时钟配置落库后刷新仍在」与 widgets.test.ts 的 store 往返用例守住，这里不逐件重跑同一管道
 *
 * 没有写动作的件（storage / system / recent-files / notification-summary / data-summary）不是漏测：
 * 它们不声明 `manifest.data`，最后一条反向断言守住「交互不产出持久化写」——
 * 月历点日期走的 `setSelected` 是运行态（§4.5），落库就该判红。
 */
test.describe('T1 持久化往返（每个写动作 → reload 仍在）', () => {
  test.use({ viewport: { width: 1440, height: 1100 } })

  const TASKS_PATH = '/我的数据/tasks.json'
  const notePath = (id: string) => `/我的数据/sticky-note/${id}.json`

  const tasksDoc = (kv: Record<string, unknown>) =>
    JSON.parse(fsNodeContent(kv, TASKS_PATH) ?? '{"tasks":[]}') as {
      tasks: { id: string; title: string; done: boolean }[]
    }

  test('T1 todos·lg 勾选完成 → reload 仍已完成', async ({ page }) => {
    await mount(page, [{ kind: 'todos', size: 'lg' }])
    const card = cardOf(page, { kind: 'todos', size: 'lg' })
    const firstTitle = (
      await card.locator('ul > li').first().locator('span').first().innerText()
    ).trim()
    await card.getByRole('checkbox').first().click()
    await persistThenReload(page, (kv) => tasksDoc(kv).tasks.map((t) => t.done), [
      true,
      ...Array(8).fill(false),
    ])
    // 进度数的是 scoped（含已完成），列表按 showCompleted 缺省 false 把它滤掉
    await expect(card.getByText(/^完成 \d+\/\d+$/)).toHaveText('完成 1/9')
    await expect(card.getByText(firstTitle)).toHaveCount(0)
  })

  test('T1 todos·lg 新增待办 → reload 那条还在', async ({ page }) => {
    await mount(page, [{ kind: 'todos', size: 'lg' }])
    const card = cardOf(page, { kind: 'todos', size: 'lg' })
    await card.getByRole('textbox', { name: '添加待办' }).fill('验收新增的待办')
    await page.keyboard.press('Enter')
    await persistThenReload(page, (kv) => tasksDoc(kv).tasks.map((t) => t.title), [
      ...SEEDED_TASK_TITLES,
      '验收新增的待办',
    ])
    // 第 10 条排在 `limit=5` 的行预算之外，所以它在**屏上**的存在形式是「还有 5 项」与分母，
    // 不是那一行本身（R3：溢出走截断 + 计数出口，不滚动）。别去赌排序把新条目排进窗口。
    await expect(card.getByText(/^完成 \d+\/\d+$/)).toHaveText('完成 0/10')
    await expect(card.getByText('还有 5 项')).toBeVisible()
  })

  test('T1 todos·lg 删除待办 → reload 不复活', async ({ page }) => {
    await mount(page, [{ kind: 'todos', size: 'lg' }])
    const card = cardOf(page, { kind: 'todos', size: 'lg' })
    const first = card.locator('ul > li').first()
    const gone = (await first.locator('span').first().innerText()).trim()
    await first.getByRole('button', { name: '删除这条待办' }).click()
    await persistThenReload(page, (kv) => tasksDoc(kv).tasks.map((t) => t.title), [
      ...SEEDED_TASK_TITLES.slice(1),
    ])
    await expect(card.getByText(gone)).toHaveCount(0)
    await expect(card.getByText(/^完成 \d+\/\d+$/)).toHaveText('完成 0/8')
  })

  test('T1 todos·md 勾选完成 → reload 仍已完成（md 没有添加表单，勾选是它唯一的写）', async ({
    page,
  }) => {
    await mount(page, [{ kind: 'todos', size: 'md' }])
    const card = cardOf(page, { kind: 'todos', size: 'md' })
    await card.getByRole('checkbox').first().click()
    await persistThenReload(page, (kv) => tasksDoc(kv).tasks.map((t) => t.done), [
      true,
      ...Array(8).fill(false),
    ])
    await expect(card.getByText(/^完成 \d+\/\d+$/)).toHaveText('完成 1/9')
  })

  test('T1 sticky-note·lg 就地编辑正文 → reload 文本仍在', async ({ page }) => {
    await mount(page, [{ kind: 'sticky-note', size: 'lg' }])
    const card = cardOf(page, { kind: 'sticky-note', size: 'lg' })
    await card.getByRole('textbox').fill('验收文本 2026-10-06')
    // 「已保存」是本次编辑的即时反馈（touched 是组件局部态），reload 后本就该消失——它守的是写动作有回显
    await expect(card.getByText('已保存')).toBeVisible()
    await persistThenReload(
      page,
      (kv) => JSON.parse(fsNodeContent(kv, notePath('wgt-sticky-note-lg')) ?? '{}').text,
      '验收文本 2026-10-06',
    )
    await expect(card.getByRole('textbox')).toHaveValue('验收文本 2026-10-06')
    // 这里只证明**落点含实例 id**（scope: 'instance' 的寻址形状）；两张卡互不串台要多实例那条腿（§4.2 实例域）
  })

  test('T1 sticky-note·md 只读：给不出编辑面就不会凭空多一条写通道', async ({ page }) => {
    await mount(page, [{ kind: 'sticky-note', size: 'md' }])
    const card = cardOf(page, { kind: 'sticky-note', size: 'md' })
    await expect(card.locator('textarea')).toHaveCount(0)
    await expect(card.getByText('水电费 renewal 记得周三前提交，顺带确认巡检排班表')).toBeVisible()
  })

  test('T1 control-center·md 切深色 → reload 主题仍是深色（写的是平台状态，不是件数据）', async ({
    page,
  }) => {
    await mount(page, [{ kind: 'control-center', size: 'md' }])
    const card = cardOf(page, { kind: 'control-center', size: 'md' })
    await card.getByRole('button', { name: '深色' }).click()
    await persistThenReload(page, (kv) => (kv[THEME_KEY] as { mode?: string })?.mode, 'dark')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(card.getByRole('button', { name: '深色' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('T1 control-center·lg 换壁纸 → reload 壁纸与桌面材质一致', async ({ page }) => {
    await mount(page, [{ kind: 'control-center', size: 'lg' }])
    const card = cardOf(page, { kind: 'control-center', size: 'lg' })
    await card.getByRole('button', { name: '青玉' }).click()
    await persistThenReload(
      page,
      (kv) => (kv[THEME_KEY] as { wallpaper?: string })?.wallpaper,
      'wallpaper-jade',
    )
    await expect(card.getByRole('button', { name: '青玉' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('T1 无写动作的件：交互一轮后 fs-v1 与 widgets-v1 分毫不动', async ({ page }) => {
    const combos: Combo[] = [
      { kind: 'storage', size: 'sm' },
      { kind: 'system', size: 'sm' },
      { kind: 'recent-files', size: 'md' },
      { kind: 'notification-summary', size: 'sm' },
      { kind: 'data-summary', size: 'md' },
      { kind: 'calendar', size: 'lg' },
    ]
    await mount(page, combos)
    const before = await readKv(page, [FS_KEY, WIDGETS_KEY])
    // 「分毫不动」判的是整份快照（fs-v1 连每个节点的内容一起比），不是路径名集合：
    // 只比名字时「把 events.json 改写了但没增删文件」这一形照样绿，而它正是这条腿要防的写盘。
    const fsSnapshot = (kv: Record<string, unknown>) => JSON.stringify(kv[FS_KEY] ?? null)
    const bothSnapshot = (kv: Record<string, unknown>) =>
      JSON.stringify([kv[FS_KEY] ?? null, kv[WIDGETS_KEY] ?? null])

    // 月历点日期＝§4.5 的 setSelected（运行态下钻上下文），它落库就是缺陷
    const calendar = cardOf(page, { kind: 'calendar', size: 'lg' })
    await calendar.getByRole('button', { name: '查看 15 日' }).click()
    await expect(calendar.getByRole('button', { name: '查看 15 日' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // 翻月是本地视图状态，同样不进持久化；先证明这一动真的动了（否则两个动作里有一个是空跑）
    const monthTitle = calendar.locator('[data-widget-content] .text-title').first()
    const titleBefore = await monthTitle.innerText()
    await calendar.getByRole('button', { name: '下个月' }).click()
    await expect(monthTitle).not.toHaveText(titleBefore)

    // 落库是 fire-and-forget，而件数据写还有 300ms 合并窗口（useWidgetData 的 DATA_WRITE_DEBOUNCE）：
    // 刚点完就连读两次「一样」只说明防抖还没开火，不说明没写。所以要读到快照不再变、且已跨过一整个
    // 合并窗口才算安静（floor = 2×300ms）。仍是 poll 不是 sleep：写晚到时它会一直读到它浮出来。
    const quietFloorAt = Date.now() + 600
    let prevSnapshot = bothSnapshot(await readKv(page, [FS_KEY, WIDGETS_KEY]))
    await expect
      .poll(
        async () => {
          const now = bothSnapshot(await readKv(page, [FS_KEY, WIDGETS_KEY]))
          const changed = now !== prevSnapshot
          prevSnapshot = now
          return !changed && Date.now() >= quietFloorAt
        },
        { timeout: 15_000, intervals: [300] },
      )
      .toBe(true)

    const after = await readKv(page, [FS_KEY, WIDGETS_KEY])
    expect(fsSnapshot(after), 'fs-v1 动了').toBe(fsSnapshot(before))
    expect(JSON.stringify(after[WIDGETS_KEY]), 'widgets-v1 动了').toBe(
      JSON.stringify(before[WIDGETS_KEY]),
    )
  })
})

/* ═══════════════════════════ T2 死白率 ═══════════════════════════ */

/**
 * §附之一的测法：内容最后一个元素的底部对卡底，算进卡片内框（扣掉宿主给的内边距）。
 * 贴边流式的内容（月历 / 待办 / 快捷设置）只看卡底那条带；整块居中的内容（时钟、存储）
 * 空白是 §4.4 R1 预算内被对称分掉的，只罚居中分不掉的余量（flowDead）。
 * 字面口径（包围盒/内框 ≥85%）不取，理由见本 describe 末尾的裁决注释。
 * 同一条腿反方向还判「内容越出内框」：卡片是 overflow-hidden，挤出去的部分不报错、不留滚动条，
 * 直接被裁掉——死白腿只看「太空」，看不见「太挤」，所以 §4.4 R4 的密度上界在这里有一条机器腿。
 */
test.describe('T2 死白率 + 不裁切（每件 × 每档，连续死白 ≤15% 且内容不越出内框）', () => {
  test.use({ viewport: { width: 1440, height: 1100 } })

  for (const kind of KINDS) {
    test(`T2 ${kind}（${KIND_SIZES[kind].join('/')}）连续死白 ≤${DEAD_LIMIT}% 且无越框裁切`, async ({
      page,
    }) => {
      const combos = combosOf(kind)
      await mount(page, combos)
      const rows = (await readCards(page)).filter((r) => r.kind === kind)
      expect(rows, `${kind} 的每个档位都应出现在桌面`).toHaveLength(combos.length)

      const table = deadTable(rows)
      note(table)
      for (const r of rows) {
        expect(
          r.flowDead,
          `${r.kind}·${r.size} 连续死白 ${r.flowDead}%（${r.anchor} 锚定，尾带 ${r.bottomDead}% / 头带 ${r.topDead}%）应 ≤${DEAD_LIMIT}%${table}`,
        ).toBeLessThanOrEqual(DEAD_LIMIT)
        expect(
          spillPx(r),
          `${r.kind}·${r.size} 内容越出内框 ${spillPx(r)}px（被 overflow-hidden 裁掉，不是「挤一点」）${table}`,
        ).toBe(0)
      }
    })
  }

  /**
   * 口径裁决（§8 偏差 15）：判据取 U4 的原话「**连续**死白 ≤15%」与 §附之一 E3 的读法
   * （「内容止于 y=428，卡底 572 → 144px / 41.9%」——那是一条带，不是包围盒占比），
   * 所以上面按 flowDead 判，十件全绿。
   * 字面「内容包围盒 / 卡片内框 ≥85%」也测过一轮，读数每次跑都在 deadTable 的 slack 列：
   *   storage·sm 85.7%（宽占用 36.5%）· clock·lg 75.6% · sticky-note·md 69% · clock·sm 67.6%
   *   · notification-summary·sm 60.3%（宽占用 37.3%）· clock·md 51.5% · storage·md 44.4%
   * 流式件全部 ≤3.7%（月历 lg 1.3%、待办 md 3.7%）。即字面口径打在「整块居中 + R1 的小预算」上：
   * sm 内框 126~136px 里「一个数字 + 一行标签」两行墨迹数学上撑不满 85%，
   * 拿它当判据等于要求 §4.4 R1 重写——故不取，也不留一条永久 fixme 冒充门禁。
   */
})

/* ═══════════════ A-9 上次更新时间（§4.3 / HIG A-9）═══════════════ */

/**
 * 「更新于」这条读数在 §4.3 有契约（`lastRefreshAt` + `refresh`），但 §9 验收表里没有对应的腿：
 * 死白/对比度/命中区都只判「已有的东西好不好」，没有一条判「该有的是否存在」。
 * 落位按档不同（storage/notification 走行、system·md 走第 6 格、data-summary 走标题行右端），
 * 所以这里只认「每档一条且非空」——把每件每档的落位变化钉死，而不是钉死某个 DOM 形状。
 */
test.describe('A-9 数据型件每档恰有一条「更新于」，其余件一条都不许有（§4.3）', () => {
  test.use({ viewport: { width: 1440, height: 1100 } })

  for (const kind of KINDS) {
    const want = A9_KINDS.includes(kind) ? 1 : 0
    test(`A-9 ${kind}（${KIND_SIZES[kind].join('/')}）应恰有 ${want} 条读数`, async ({ page }) => {
      const combos = combosOf(kind)
      await mount(page, combos)
      const rows = (await readCards(page)).filter((r) => r.kind === kind)
      expect(rows, `${kind} 的每个档位都应出现在桌面`).toHaveLength(combos.length)

      for (const r of rows) {
        expect(
          r.updated.length,
          `${r.kind}·${r.size} 的「更新于」条数是 ${r.updated.length}，应为 ${want}${updatedTable(rows)}`,
        ).toBe(want)
        if (want) {
          expect(
            r.updated[0],
            `${r.kind}·${r.size} 有一条空读数＝等于没有读数${updatedTable(rows)}`,
          ).not.toBe('')
        }
      }
    })
  }
})

/* ═══════════════════ T3 对比度 + 文字地板 ═══════════════════ */

test.describe('T3 文字地板 + 墨色对比度（§4.6 / HIG H-2）', () => {
  test.use({ viewport: { width: 1440, height: 1100 } })

  /**
   * 每件 × 两套主题 × 三壁纸（§9 T3 的口径）。
   * 主题/壁纸都按 theme-v1 播种后 reload：件内 chip 带色彩过渡，运行中翻根属性会量到中间色。
   * 顺带钉住 §4.6 的立约：换壁纸时卡片底与三档墨色 token、以及全部死白/字号读数一个字节都不变
   * ——可读性来自卡片自带的底，不外包给壁纸。
   */
  for (const kind of KINDS) {
    test(`T3 ${kind}（${KIND_SIZES[kind].join('/')} × 两主题 × 三壁纸）文字 ≥${FONT_FLOOR}px 且墨色 ≥${AA_BODY}:1`, async ({
      page,
    }) => {
      const combos = combosOf(kind)
      for (const mode of MODES) {
        let baseTokens: TokenReading | null = null
        let baseGeometry: string | null = null
        for (const wallpaper of WALLPAPERS) {
          const tag = `${mode}/${wallpaper}`
          await mount(page, combos, { mode, wallpaper })
          const rows = (await readCards(page)).filter((r) => r.kind === kind)
          expect(rows, `${tag} 下 ${kind} 的每个档位都应出现在桌面`).toHaveLength(combos.length)

          const listing = fontTable(rows, tag)
          note(listing)
          const flat = rows.flatMap((r) =>
            r.leaves.map((l) => `  ${r.kind}·${r.size} <${l.tag}>「${l.text}」 ${l.fontSize}px`),
          )
          expect(flat.length, `${tag} 下 ${kind} 应当有文字叶子可量`).toBeGreaterThan(0)

          // 卡片底＝surface token 本身，且三档墨色 + 全部读数与壁纸无关
          for (const r of rows) {
            expect(
              r.bg,
              `${tag} 下 ${r.kind}·${r.size} 的卡片底应就是 --raw-widget-surface，实测 ${r.bg}`,
            ).toBe(r.tokens.surface)
          }
          baseTokens ??= rows[0]!.tokens
          expect(rows[0]!.tokens, `${wallpaper} 不该改写小组件表面/墨色 token`).toEqual(baseTokens)

          const geometry = JSON.stringify(
            rows.map((r) => [
              r.inner,
              r.bg,
              r.bottomDead,
              r.topDead,
              r.slack,
              r.flowDead,
              r.widthUsed,
            ]),
          )
          baseGeometry ??= geometry
          expect(
            geometry,
            `${mode} 下 ${kind} 的死白/几何读数不该随壁纸变化（首个壁纸=${WALLPAPERS[0]}）`,
          ).toBe(baseGeometry)

          const minFont = Math.min(...rows.flatMap((r) => r.leaves.map((l) => l.fontSize)))
          expect(
            minFont,
            `${tag} 下 ${kind} 最小字号 ${minFont}px 低于 ${FONT_FLOOR}px 地板（HIG H-2）${listing}`,
          ).toBeGreaterThanOrEqual(FONT_FLOOR)

          const worst = rows.flatMap((r) => r.leaves).reduce((a, b) => (a.ratio <= b.ratio ? a : b))
          expect(
            worst.ratio,
            `${tag} 下 ${kind} 最差墨色「${worst.text}」${worst.color} 对卡片底仅 ${worst.ratio}:1，应 ≥${AA_BODY}:1${listing}`,
          ).toBeGreaterThanOrEqual(AA_BODY)
        }
      }
    })
  }

  /**
   * §4.6 立约之处的聚合判法（十件同屏 × 三壁纸）：卡片必须自带可读底，
   * 于是「三档墨色对卡片底」是 token 层的算术，与挂哪张壁纸无关。
   * 历史读数（附之一）：浅色主题白字压在 wallpaper-sky 上只有 1.15~2.49:1。
   * 逐件逐档的字号/墨色地板在上面那组用例里。
   */
  for (const mode of MODES) {
    test(`T3 ${mode}：三壁纸下卡片底＝surface token、三档墨色 ≥${AA_BODY}:1 且读数与壁纸无关`, async ({
      page,
    }) => {
      const combos = KINDS.map((kind) => ({ kind, size: KIND_SIZES[kind][0] }) as Combo)
      let baseTokens: TokenReading | null = null
      let baseGeometry: string | null = null
      const ratioRows: string[] = []

      for (const wallpaper of WALLPAPERS) {
        await mount(page, combos, { mode, wallpaper })
        const rows = await readCards(page)
        expect(rows, `${mode}/${wallpaper} 应把十件全部装上桌面`).toHaveLength(combos.length)

        const wallpaperOn = await page.evaluate(
          (key: string) => Boolean(document.querySelector(`div.absolute.inset-0.${key}`)),
          wallpaper,
        )
        expect(wallpaperOn, `桌面应挂上 ${wallpaper}`).toBe(true)

        for (const r of rows) {
          expect(
            r.bg,
            `${mode}/${wallpaper} 下 ${r.kind}·${r.size} 的卡片底应就是 --raw-widget-surface（实测 ${r.bg}）`,
          ).toBe(r.tokens.surface)
        }
        baseTokens ??= rows[0]!.tokens
        expect(rows[0]!.tokens, `${wallpaper} 不该改写小组件表面/墨色 token`).toEqual(baseTokens)

        const geometry = JSON.stringify(
          rows.map((r) => [
            r.kind,
            r.inner,
            r.bottomDead,
            r.topDead,
            r.slack,
            r.flowDead,
            r.widthUsed,
          ]),
        )
        baseGeometry ??= geometry
        expect(geometry, `${mode} 下十件的死白/几何读数不该随壁纸变化`).toBe(baseGeometry)

        const ratios = await page.evaluate(inkRatios, rows[0]!.tokens)
        ratioRows.push(
          `${wallpaper}: ink ${ratios.ink}:1 / mute ${ratios.inkMute}:1 / disabled ${ratios.inkDisabled}:1`,
        )
        for (const [name, value] of Object.entries(ratios)) {
          expect(
            value,
            `${mode}/${wallpaper} 的 --color-widget-${name} 对卡片底只有 ${value}:1，应 ≥${AA_BODY}:1（三档读数 ${JSON.stringify(ratios)}）`,
          ).toBeGreaterThanOrEqual(AA_BODY)
        }
      }
      note(`\ntoken 层三档墨色对比度（${mode}）:\n${ratioRows.join('\n')}`)
    })
  }
})

/* ═══════════════════════ T4 命中区 ≥24×24 ═══════════════════════ */

test.describe('T4 命中区（R4：件内每个可交互目标 ≥24×24）', () => {
  test.use({ viewport: { width: 1440, height: 1100 } })

  // 这里不留「已知不达标」豁免表：地板就是地板。月历 md 曾以 42.3×13 的日格撞它，
  // 裁决是降级交互而非降级内容（md 网格改阅读面，点日期只在 lg），见 §8 偏差 14。
  for (const kind of KINDS) {
    test(`T4 ${kind}（${KIND_SIZES[kind].join('/')}）命中区 ≥${TARGET_MIN}×${TARGET_MIN}`, async ({
      page,
    }) => {
      const combos = combosOf(kind)
      await mount(page, combos)
      const rows = (await readCards(page)).filter((r) => r.kind === kind)
      const all = rows.flatMap((r) => r.targets)
      note(targetTable(rows))
      // 这里量到的一律是件内目标：卡片表面已无宿主自绘浮标（移除钮与拖角手柄都摘了，偏差 29）
      if ((DISPLAY_ONLY_KINDS as readonly string[]).includes(kind)) {
        expect(all, `${kind} 是展示型件：件内不放控件、表面不放浮标，量到目标就是越界`).toEqual([])
      } else {
        expect(all.length, `${kind} 应至少量到一个可交互目标`).toBeGreaterThan(0)
      }
      const bad = all.filter((t) => t.w < TARGET_MIN || t.h < TARGET_MIN)
      expect(bad.length, `${kind} 命中区不达标${targetTable(rows)}`).toBe(0)
    })
  }

  /**
   * 地板要在**最差的那一屏**上量，不是在默认种子的某一屏上量。月历 lg 的日格行高走
   * `minmax(0,1fr)`，由「内框（344 − 2 边框 − 22 内衬 = 320）− 标题行 − 星期表头 − 议程块」倒推，
   * 而议程块按当天事件数吃行：默认种子是 5 行的月份，翻到 6 行（每 2~3 个月就有一个）就少一行。
   * 算术：地板要 6×24 + 5×4 = 164px，议程满（3 条 +「还有 N 项」= 115px，含 pt/border/行距）时
   * 只剩 320 −（29 标题 + 18 表头 + 12 根间隙）− 115 = 146px ⇒ 每格 **21px**，撞上这条地板。
   * 偏差 14 已裁决「地板就是地板，互斥时降级的是交互不是内容」，md 照它办了；lg 是同一根因的另一半
   * （它是唯一把 24px 地板交给「今天恰好几条日程 + 这个月几行」决定的件），所以这条腿照写，不写已知不达标。
   */
  test('T4 calendar·lg 翻到 6 行的月份（议程满）日格仍 ≥24', async ({ page }) => {
    const combo = { kind: 'calendar', size: 'lg' } as const
    await mount(page, [combo])
    const card = cardOf(page, combo)
    await expect(card).toBeVisible()

    const grid = card.locator('div.grid.min-h-0.flex-1')
    // 只在件内容里数：卡片表面已无宿主浮标，但口径仍按内容 wrapper 收
    const next = card.locator('[data-widget-content] button.h-6.w-6').nth(1)
    let rowCount = 0
    for (let i = 0; i < 12 && rowCount !== 6; i++) {
      rowCount = Math.round((await grid.locator(':scope > div').count()) / 7)
      if (rowCount !== 6) await next.click()
    }
    expect(rowCount, '12 个月内翻不到 6 行的月份，这条腿就成了空腿').toBe(6)

    // 议程得真的占着「3 条 + 计数出口」那一整块，否则最差形态没有成立（这条腿的算术前提是它吃 115px）
    await expect(card.locator('[data-widget-content] ul > li')).not.toHaveCount(0)
    await expect(
      card.locator('[data-widget-content] p').filter({ hasText: '还有' }),
      '议程没截断出「还有 N 项」，说明喂的事件不够，最差形态没量到',
    ).toHaveCount(1)

    const shape = await card.locator('[data-widget-content]').evaluate((box) => {
      const h = (el: Element | null | undefined) =>
        el ? Number(el.getBoundingClientRect().height.toFixed(1)) : 0
      const grid = box.querySelector('div.grid.min-h-0.flex-1')
      return {
        inner: h(box),
        header: h(box.querySelector('div.shrink-0.items-center.justify-between')),
        weekday: h(box.querySelector('div.grid.shrink-0')),
        grid: h(grid),
        day: h(grid?.querySelector('button')),
        agenda: h(box.querySelector('div.mt-auto')),
      }
    })
    note(
      `月历·lg 最差形态（6 行月 + 议程满）分带：内框 ${shape.inner}px =` +
        ` 标题 ${shape.header} + 表头 ${shape.weekday} + 网格 ${shape.grid}（一格 ${shape.day}）+ 议程 ${shape.agenda}`,
    )

    const rows = (await readCards(page)).filter((r) => r.kind === 'calendar')
    note(targetTable(rows))
    const days = rows.flatMap((r) => r.targets).filter((t) => t.label.startsWith('查看')) // = widgets.calendar.pickDay
    expect(days.length, '6 行月里一个可点的日格都没量到').toBeGreaterThan(0)
    const low = days.filter((t) => t.h < TARGET_MIN || t.w < TARGET_MIN)
    expect(
      low.length,
      `日格命中区塌到 ${[...new Set(low.map((t) => t.h))].join('/')}px${targetTable(rows)}`,
    ).toBe(0)
    for (const r of rows) expect(spillPx(r), `${r.kind}·${r.size} 越框 ${spillText(r)}`).toBe(0)
  })

  /**
   * 同一根因的另一半：**可配置的行数**不许把命中区或内框挤掉。`todos` 的 `limit` 上界是 8
   * （schema 的 `max` 与 App.vue 的 clamp 双重封顶），配满时 lg 内框 320px 要排下
   * 「标题行 + 8 行清单 + 计数出口 + 就地新增」四段——缺省 limit=5 量不到这个上界，
   * 于是「有人把 max 抬到 10」或「给行加边距」这类改动今天没有腿会红。补一条。
   */
  test('T4 todos·lg 配满行预算（limit=8，正文 9 条）命中区与内框仍达标', async ({ page }) => {
    const combo = { kind: 'todos', size: 'lg', config: { limit: 8 } } as const
    await mount(page, [combo])
    const card = cardOf(page, combo)
    await expect(card).toBeVisible()

    // 最差形态要在屏上：8 行清单 + 那行「还有 N 项」
    await expect(card.locator('[data-widget-content] li [role="checkbox"]')).toHaveCount(8)
    await expect(
      card.locator('[data-widget-content] li').filter({ hasText: '还有' }),
      '没有截断出口那一行，说明正文条数不够，上界没量到',
    ).toHaveCount(1)

    const rows = (await readCards(page)).filter((r) => r.kind === 'todos')
    note(targetTable(rows))
    const bad = rows.flatMap((r) => r.targets).filter((t) => t.w < TARGET_MIN || t.h < TARGET_MIN)
    expect(bad.length, `limit=8 时命中区不达标${targetTable(rows)}`).toBe(0)
    for (const r of rows) expect(spillPx(r), `todos·${r.size} 越框 ${spillText(r)}`).toBe(0)
  })
})

/* ═══════ §4.9 月历考卷第三态：今天没有日程 ═══════ */

/**
 * lg 那一档的考卷写的是「当日日程 3 条 + 还有 N 项；**无日程时该行落为农历/干支日**」（§4.9），
 * 而 §4.4 的降级硬要求是「拿不到就整项不渲染，不留 —/NaN」。这两句此前都没有腿：
 * 议程块按 `todayIso` 过滤（点别的日子不会掏空它），所以要把这一态做出来只能把事件播种到**别的日子**
 * （`mount` 的第四参）；而农历只在 `zh*` 界面给，非中文那一态又必须靠切 locale 才量得到。
 * 三条腿各判一件事：态是否成立、落位是否不留白、语言条件是否真的生效。
 */
test.describe('§4.9 月历·lg 无日程那态：农历行 / 非中文界面回落空文案', () => {
  test.use({ viewport: { width: 1440, height: 1100 } })

  const combo = { kind: 'calendar', size: 'lg' } as const

  test('今天无日程 → 议程块整块换成一行农历，不留占位符', async ({ page }) => {
    await mount(page, [combo], {}, { eventsOn: 'other' })
    const card = cardOf(page, combo)

    // 空态成立：不是「一张空列表」，而是整块换内容（§4.4 R2 宁缺不夹生）
    await expect(card.locator('[data-widget-content] ul > li')).toHaveCount(0)
    await expect(card.getByText(/^今天有 \d+ 项日程$/)).toHaveCount(0)
    const lunar = card.getByText(/^农历 \S/)
    await expect(lunar, '农历行没落位，§4.9 考卷的第三态在屏上不存在').toHaveCount(1)
    await expect(lunar).not.toContainText('undefined')
    await expect(card.locator('[data-widget-content]')).not.toContainText(/—|NaN|undefined/)
  })

  test('农历那态仍守 §4.4 的空白与越框判据（网格吃满余量，不留半张空卡）', async ({ page }) => {
    await mount(page, [combo], {}, { eventsOn: 'other' })
    const rows = (await readCards(page)).filter((r) => r.kind === 'calendar')
    expect(rows).toHaveLength(1)
    const r = rows[0]
    note(`月历·lg 议程空态：used ${r.used.toFixed(1)}%，越框 ${spillText(r)}`)
    // 日格走 `min-h-0 flex-1` 的网格，议程少两块行高应由网格吃掉；吃掉不了就是死白带。
    // 量测踩点：`CardReading.used` 与 T2 同口径是**百分数**（`pct()` 已乘 100）。写这条时先按
    // 小数比了一次，`0.85` 对 98.8 恒真＝一条不会红的腿，实测读数把它暴露出来后才改成 85。
    expect(
      r.used,
      `空态那一屏内容只占内框 ${r.used.toFixed(1)}%（判据 ≥85%，§9 T2 的死白地板）`,
    ).toBeGreaterThanOrEqual(85)
    expect(spillPx(r), `空态越框 ${spillText(r)}`).toBe(0)
  })

  test('农历只在中文界面给：切到 English 后该行回落空文案，不画农历', async ({ page }) => {
    const cc = { kind: 'control-center', size: 'lg' } as const
    await mount(page, [combo, cc], {}, { eventsOn: 'other' })
    await cardOf(page, cc).getByRole('button', { name: 'English', exact: true }).click()

    const card = cardOf(page, combo)
    await expect(card.getByText(/^农历/)).toHaveCount(0)
    await expect(
      card.getByText('No events today'),
      '非中文界面既不给农历也不给空态文案，那一块就是空的',
    ).toHaveCount(1)
  })
})

/* ═══════ §4.9 时钟考卷：档位预算压过配置 ═══════ */

/**
 * 时钟的考卷三档各异（sm 无秒 / md 加日期 / lg 才给第二时区行），而 `seconds` 与 `secondTz`
 * 都是**用户可配**字段。§4.4 R1 的「每档有自己的内容预算」意味着配置不得越过档位——这与
 * 偏差 20 同源（体积由配置决定时必须由档位封顶），此前同样没有腿：件内那三行
 * `config.value.X && size.value !== 'sm'` 与 `size === 'lg' && secondTz` 全靠作者记得写。
 */
test.describe('§4.9 时钟：秒数按档封、第二时区行按 config 出现、12/24 小时制真的换钟面', () => {
  test.use({ viewport: { width: 1440, height: 1100 } })

  const face = (card: ReturnType<typeof cardOf>) =>
    card.locator('[data-widget-content] p').first().innerText()

  test('sm 配 seconds=true 仍不画秒，md 同配置画秒（档位预算压过配置）', async ({ page }) => {
    await mount(page, [
      { kind: 'clock', size: 'sm', config: { seconds: true } },
      { kind: 'clock', size: 'md', config: { seconds: true } },
    ])
    const sm = await face(cardOf(page, { kind: 'clock', size: 'sm' }))
    const md = await face(cardOf(page, { kind: 'clock', size: 'md' }))
    expect(sm, `sm 钟面「${sm}」画出了秒——档位预算被配置越过了`).toMatch(/^\d{2}:\d{2}$/)
    expect(md, `md 钟面「${md}」没有秒——seconds=true 在该档没生效`).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })

  test('lg 配 secondTz=tokyo：第二行给城市名 + 白天/夜间文字 + 该时区时刻', async ({ page }) => {
    const combo = { kind: 'clock', size: 'lg', config: { secondTz: 'tokyo' } } as const
    await mount(page, [combo])
    const row = cardOf(page, combo).locator('[data-widget-content] div.mt-2')
    await expect(row, '第二时区行没落位，§4.9 考卷 lg 那一档的第三层内容在屏上不存在').toHaveCount(
      1,
    )
    await expect(row.getByText('东京')).toHaveCount(1)
    await expect(row.getByText(/^\d{2}:\d{2}$/)).toHaveCount(1)
    // 日/夜走文字不走颜色（H-3）；这一条按同一条 6–18 规则在测试进程里独立算一遍再比
    const tokyoHour = Number(
      new Date()
        .toLocaleTimeString('en-US', { hour: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' })
        .slice(0, 2),
    )
    const isDay = tokyoHour >= 6 && tokyoHour < 18
    await expect(row.getByText(isDay ? '白天' : '夜间')).toHaveCount(1)
    await expect(row.getByText(isDay ? '夜间' : '白天')).toHaveCount(0)
  })

  test('缺省 secondTz=local 时那一行整块不渲染（降级不留占位）', async ({ page }) => {
    const combo = { kind: 'clock', size: 'lg', config: { secondTz: 'local' } } as const
    await mount(page, [combo])
    const card = cardOf(page, combo)
    await expect(card.locator('[data-widget-content] div.mt-2')).toHaveCount(0)
    await expect(card.getByText(/白天|夜间/)).toHaveCount(0)
  })

  test('第二时区行是 lg 独占：md 配上 secondTz 也不画（档位层层扩展，不是每档都给全）', async ({
    page,
  }) => {
    const combo = { kind: 'clock', size: 'md', config: { secondTz: 'tokyo' } } as const
    await mount(page, [combo])
    const card = cardOf(page, combo)
    // 配了值但档位不给这一层：件必须按档渲染，不按配置渲染（R1/R2），否则 md 的预算被配置顶穿
    await expect(
      card.locator('[data-widget-content] div.mt-2'),
      'md 画出了 lg 独占的第二时区行',
    ).toHaveCount(0)
    await expect(card.getByText('东京')).toHaveCount(0)
    await expect(card.getByText(/白天|夜间/)).toHaveCount(0)
  })

  test('hour12 换的是钟面本身：12 小时制带时段词，24 小时制是纯数字', async ({ page }) => {
    const h12 = { kind: 'clock', size: 'md', config: { hour12: true, seconds: false } } as const
    const h24 = { kind: 'clock', size: 'lg', config: { hour12: false, seconds: false } } as const
    await mount(page, [h12, h24])
    const twelve = await face(cardOf(page, h12))
    const twentyFour = await face(cardOf(page, h24))
    // zh-CN 的 12 小时制是「下午01:05」这种「时段词 + 两位时」，24 小时制是「13:05」
    expect(twelve, `hour12=true 的钟面「${twelve}」不是时段词打头的形态`).toMatch(
      /^\D+\d{2}:\d{2}$/,
    )
    expect(twentyFour, `hour12=false 的钟面「${twentyFour}」不是纯数字形态`).toMatch(
      /^\d{2}:\d{2}$/,
    )
    const hour = Number(twelve.match(/(\d{2}):\d{2}/)![1])
    expect(hour, `12 小时制钟面给出了 ${hour} 时`).toBeGreaterThanOrEqual(1)
    expect(hour, `12 小时制钟面给出了 ${hour} 时`).toBeLessThanOrEqual(12)
  })
})

/* ═══════ §4.4 配置面：每个 config 字段都要「真的改变渲染」 ═══════ */

/**
 * 时钟那轮的反证（功能设计 §9「§4.9 时钟：秒数按档封」）暴露的是一整类无腿判据：
 * `weekStart`/`showAgenda`/`count`/`unit`/`metric`/`showCompleted`/`scope` 这些字段只在
 * **持久化腿**里被「写进去、读回来」（`widget-persistence` 那一份证的是 store 往返），
 * 从没在渲染腿里被「改一下、画得不一样」。也就是说把件内那行 `config.value.X` 整句删掉，
 * 全量验收照旧绿——字段是摆设也没人报。
 * 这一份逐字段做成**双臂**判据：同一次 mount 里两个档各配一个值，两个方向都能单独变红
 * （忽略字段 ⇒ 一侧少画/多画；恒取一侧 ⇒ 另一侧红）。到达某一态所需的播种由
 * `SeedOptions` 的旋钮负责（`recentFiles`/`doneTasks`/`overdueTasks`），默认全关，
 * 免得把 T2/T3/T4 量的那一屏一起改掉。
 */
test.describe('§4.4 配置面：每个 config 字段都有「真的改变渲染」的双臂腿', () => {
  test.use({ viewport: { width: 1440, height: 1100 } })

  const weekdayHeaders = (card: Locator) =>
    card.locator('[data-widget-content] .grid.shrink-0 > span').allInnerTexts()

  /** 首日之前的上月占位数：表头错开一格必须连带落到日格，否则字段只改了标签 */
  const leadCells = (card: Locator) =>
    card
      .locator('[data-widget-content] .grid.min-h-0 > div')
      .evaluateAll((cells) =>
        cells.findIndex(
          (c) => !(c.getAttribute('class') ?? '').includes('text-widget-ink-disabled'),
        ),
      )

  test('weekStart：sunday 与 monday 的表头与首行占位整体错开一格', async ({ page }) => {
    const sun = { kind: 'calendar', size: 'md', config: { weekStart: 'sunday' } } as const
    const mon = { kind: 'calendar', size: 'lg', config: { weekStart: 'monday' } } as const
    await mount(page, [sun, mon])
    const a = await weekdayHeaders(cardOf(page, sun))
    const b = await weekdayHeaders(cardOf(page, mon))
    expect(a).toHaveLength(7)
    expect(b).toHaveLength(7)
    expect(new Set(a).size, `sunday 起始表头出现重复：${a.join('/')}`).toBe(7)
    expect(b[0], `monday 首列「${b[0]}」不是 sunday 序列的第二列「${a[1]}」`).toBe(a[1])
    expect(b[6], `monday 末列「${b[6]}」回绕不到 sunday 首列「${a[0]}」`).toBe(a[0])
    const leadSun = await leadCells(cardOf(page, sun))
    const leadMon = await leadCells(cardOf(page, mon))
    expect(leadMon, `首行占位没随 weekStart 变（sunday ${leadSun} → monday ${leadMon}）`).toBe(
      (leadSun + 6) % 7,
    )
  })

  test('weekStart=auto 走的是界面语言那条规则（中文按周一），不是写死的缺省列', async ({
    page,
  }) => {
    const auto = { kind: 'calendar', size: 'md' } as const
    const mon = { kind: 'calendar', size: 'lg', config: { weekStart: 'monday' } } as const
    await mount(page, [auto, mon])
    const a = await weekdayHeaders(cardOf(page, auto))
    const b = await weekdayHeaders(cardOf(page, mon))
    // 上一条已证 monday≠sunday，所以这一条把 auto 钉在 monday 那一侧
    expect(a.join('/'), `auto 表头 ${a.join('/')} 与显式 monday ${b.join('/')} 不同序`).toBe(
      b.join('/'),
    )
  })

  /**
   * 双臂分两条腿写，不塞进同一次 mount：`mount()` 的实例 id 是 `wgt-<kind>-<size>`，同 kind 同档
   * 给两个值会撞成同一个 id（strict mode 立刻命中两块卡）。拆成「true 一条 / false 一条」后
   * 两个方向仍然各自单独可红——关掉还在画红在假臂，永远不画红在真臂。
   * 每条里各带一个 md 臂：md 的内容预算里没有议程层，字段给哪一侧都不许把它带进 md（§4.9「档位是渲染口径」）。
   */
  test('showAgenda=true（lg）：议程层在屏，md 同配置也不越档画', async ({ page }) => {
    const on = { kind: 'calendar', size: 'lg', config: { showAgenda: true } } as const
    const mdOn = { kind: 'calendar', size: 'md', config: { showAgenda: true } } as const
    await mount(page, [on, mdOn], {}, { eventsOn: 'today' })
    // 种子给的是「今天 4 条事件」那一屏：字段为 true 时议程块与它的计数出口都必须在
    const onCard = cardOf(page, on)
    await expect(onCard.locator('[data-widget-content] div.mt-auto')).toHaveCount(1)
    await expect(
      onCard.getByText(/今天有 \d+ 项日程|还有 \d+ 项/),
      'showAgenda=true 时议程层里一行文字都没有：这一侧的腿没量到',
    ).not.toHaveCount(0)
    await expect(cardOf(page, mdOn).locator('[data-widget-content] div.mt-auto')).toHaveCount(0)
    const rows = (await readCards(page)).filter((r) => r.kind === 'calendar')
    for (const r of rows) expect(spillPx(r), `calendar·${r.size} 越框 ${spillText(r)}`).toBe(0)
  })

  test('showAgenda=false：lg 的议程层整块不渲染，让出的高度被日格吃满', async ({ page }) => {
    const off = { kind: 'calendar', size: 'lg', config: { showAgenda: false } } as const
    const mdOff = { kind: 'calendar', size: 'md', config: { showAgenda: false } } as const
    await mount(page, [off, mdOff], {}, { eventsOn: 'today' })
    const card = cardOf(page, off)
    // 同一份种子的反方向：真臂刚证过这一屏确实有议程层，这里计数为 0 才只能是字段关掉的
    await expect(card.locator('[data-widget-content] div.mt-auto')).toHaveCount(0)
    await expect(card.getByText(/今天有 \d+ 项日程|今天没有日程|农历|逾期/)).toHaveCount(0)
    await expect(cardOf(page, mdOff).locator('[data-widget-content] div.mt-auto')).toHaveCount(0)
    const rows = (await readCards(page)).filter((r) => r.kind === 'calendar')
    for (const r of rows) {
      expect(
        r.used,
        `关掉议程后 calendar·${r.size} 的内框占用只有 ${r.used}%：余量没被网格吃掉${deadTable(rows)}`,
      ).toBeGreaterThanOrEqual(85)
      expect(spillPx(r), `关掉议程后越框 ${spillText(r)}`).toBe(0)
    }
  })

  test('count：行数由档位封顶——md 配 8 仍只画 4 行，lg 同配置画满 8 行', async ({ page }) => {
    const md = { kind: 'recent-files', size: 'md', config: { count: 8 } } as const
    const lg = { kind: 'recent-files', size: 'lg', config: { count: 8 } } as const
    // 首启工厂只给 4 个文件：不补种就只能量到下界，8 行那一屏根本不存在（同偏差 20 的上界判据）
    await mount(page, [md, lg], {}, { recentFiles: 6 })
    await expect(
      cardOf(page, md).locator('[data-widget-content] button'),
      'md 越过了自己的 4 行预算：档位没压住配置',
    ).toHaveCount(4)
    await expect(
      cardOf(page, lg).locator('[data-widget-content] button'),
      'lg 没画到 count=8：字段是摆设',
    ).toHaveCount(8)
  })

  test('count 低于 schema 下界：宿主 clampNumber 与件内 clamp 双重封到 4 行', async ({ page }) => {
    const md = { kind: 'recent-files', size: 'md', config: { count: 2 } } as const
    const lg = { kind: 'recent-files', size: 'lg', config: { count: 2 } } as const
    await mount(page, [md, lg], {}, { recentFiles: 6 })
    await expect(cardOf(page, md).locator('[data-widget-content] button')).toHaveCount(4)
    await expect(cardOf(page, lg).locator('[data-widget-content] button')).toHaveCount(4)
  })

  test('unit：percent 给「已用 N%」、bytes 给「剩余 …」，两档都认这个字段', async ({ page }) => {
    const pct = { kind: 'storage', size: 'md', config: { unit: 'percent' } } as const
    const bytes = { kind: 'storage', size: 'sm', config: { unit: 'bytes' } } as const
    await mount(page, [pct, bytes])
    // 前置：配额读得到。读不到时两态都是空文案，这条腿会自绿（同月历第三态的判据口径）
    await expect(
      cardOf(page, pct).getByText(/已用 \d+%/),
      '读不到配额，unit 的两态判据无从成立',
    ).toHaveCount(1)
    await expect(cardOf(page, bytes).getByText(/剩余/)).toHaveCount(1)
    await expect(
      cardOf(page, bytes).getByText(/已用 \d+%/),
      'unit=bytes 仍画百分比：字段没被读',
    ).toHaveCount(0)
  })

  test('metric=memory 只剩内存那一格：概览里的网络/存储格被筛掉', async ({ page }) => {
    const one = { kind: 'system', size: 'md', config: { metric: 'memory' } } as const
    const all = { kind: 'system', size: 'sm' } as const
    await mount(page, [one, all])
    const card = cardOf(page, one)
    // 前置：这台机器报得出 deviceMemory，否则两态都空
    await expect(
      card.getByText('内存'),
      '内存格不在，这台机器没报出 deviceMemory（判据无从成立）',
    ).toHaveCount(1)
    await expect(card.getByText(/在线|离线/)).toHaveCount(0)
    await expect(card.getByText('存储')).toHaveCount(0)
    // 总览态在另一档上量（sm 概览给前两格）：证明网络/存储这些格确实存在、是被 metric 筛掉的
    await expect(cardOf(page, all).getByText(/在线|离线/)).toHaveCount(1)
  })

  test('showCompleted：缺省把已完成滤掉，true 让它回到清单并带勾态', async ({ page }) => {
    const hide = { kind: 'todos', size: 'lg', config: { showCompleted: false, limit: 3 } } as const
    const show = { kind: 'todos', size: 'md', config: { showCompleted: true } } as const
    // 标为已完成的是第 2–9 条（`sortTasks` 把已完成排到最后）：lg 滤掉后只剩第 1 条，
    // md 全给则第 2、3 条必须以勾态出现在前 3 行里
    await mount(page, [hide, show], {}, { doneTasks: 8 })
    await expect(
      cardOf(page, hide).locator('[data-widget-content] li [role="checkbox"]'),
      'showCompleted=false 仍列出已完成：滤掉那一侧没生效',
    ).toHaveCount(1)
    await expect(cardOf(page, hide).getByText(SEEDED_TASK_TITLES[1])).toHaveCount(0)
    const checked = cardOf(page, show).locator(
      '[data-widget-content] [role="checkbox"][aria-checked="true"]',
    )
    await expect(checked, 'showCompleted=true 仍看不见已完成：显示那一侧没生效').toHaveCount(2)
    await expect(cardOf(page, show).getByText(SEEDED_TASK_TITLES[1])).toHaveCount(1)
  })

  test('scope：缺省 today 滤掉逾期项，all 把它们顶到清单最前', async ({ page }) => {
    const today = { kind: 'todos', size: 'md' } as const
    const all = { kind: 'todos', size: 'lg', config: { scope: 'all', limit: 3 } } as const
    await mount(page, [today, all], {}, { overdueTasks: 2 })
    await expect(cardOf(page, today).getByText(/逾期事项/)).toHaveCount(0)
    // 两条逾期都排在前 3 行（due 升序），字段失效时它们一条都不会出现
    await expect(
      cardOf(page, all).getByText(/逾期事项/),
      'scope=all 仍看不见逾期项：范围筛选没生效',
    ).toHaveCount(2)
    await expect(cardOf(page, all).getByText(SEEDED_TASK_TITLES[0])).toHaveCount(1)
  })
})

/* ═══════════════════════ T4 键盘路径 ═══════════════════════ */

/** manifest.openAppId 声明了下钻落点的件 → Enter 应开进那个应用 */
const DRILL: { kind: keyof typeof KIND_SIZES; size: WidgetSize; app: string }[] = [
  { kind: 'calendar', size: 'lg', app: '今日' },
  { kind: 'todos', size: 'md', app: '今日' },
  { kind: 'storage', size: 'sm', app: '文件管理' },
  { kind: 'recent-files', size: 'md', app: '文件管理' },
  { kind: 'control-center', size: 'md', app: '设置' },
  { kind: 'data-summary', size: 'md', app: '数据看板' },
]

/** §4.9 准入第 3 条的下钻豁免件：Enter 不该凭空开出一扇窗 */
const NO_DRILL: (keyof typeof KIND_SIZES)[] = [
  'clock',
  'system',
  'sticky-note',
  'notification-summary',
]

test.describe('T4 键盘路径（§4.5 Enter / Delete，S-6 ⌥←⌥→，L-6 ⌘⇧方向键，⌘] 移序）', () => {
  test.use({ viewport: { width: 1440, height: 1100 } })

  for (const d of DRILL) {
    test(`T4 ${d.kind} 聚焦后 Enter 下钻到「${d.app}」`, async ({ page }) => {
      const combo = { kind: d.kind, size: d.size }
      await mount(page, [combo])
      await expect(windowOf(page, d.app)).toHaveCount(0)

      await cardOf(page, combo).focus()
      await page.keyboard.press('Enter')
      await expect(windowOf(page, d.app)).toBeVisible()
    })
  }

  test(`T4 下钻豁免件（${NO_DRILL.join('/')}）Enter 不开窗`, async ({ page }) => {
    const combos = NO_DRILL.map((kind) => ({ kind, size: KIND_SIZES[kind][0] }))
    await mount(page, combos)

    for (const combo of combos) {
      await cardOf(page, combo).focus()
      await page.keyboard.press('Enter')
    }
    await expect(page.locator('section.rounded-panel')).toHaveCount(0)
  })

  test('T4 聚焦后 Delete 移除卡片，落库后 reload 不复活', async ({ page }) => {
    const combos: Combo[] = [
      { kind: 'system', size: 'sm' },
      { kind: 'storage', size: 'sm' },
    ]
    await mount(page, combos)

    await cardOf(page, combos[0]!).focus()
    await page.keyboard.press('Delete')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: '确定' }).click()

    await expect(page.locator('[data-widget-kind="system"]')).toHaveCount(0)
    await expect(page.locator('[data-widget-kind="storage"]')).toHaveCount(1)
    await expectPersisted(page, (items) => items.map((i) => i.kindId), ['storage'])

    await page.reload()
    await expect(page.getByRole('banner')).toBeVisible()
    await expect(page.locator('[data-widget-kind="system"]')).toHaveCount(0)
    await expect(page.locator('[data-widget-kind="storage"]')).toHaveCount(1)
  })

  /**
   * 「悬停才显形」的件内控件必须同时有键盘聚焦这条出路。量 computed opacity 而非 `toBeVisible()`：
   * Playwright 的可见性只看盒子与 visibility，`opacity: 0` 照样判定可见、照样能点。
   */
  test('T4 悬停显形的件内控件在键盘聚焦时同样显形（todos·lg 删除钮）', async ({ page }) => {
    await mount(page, [{ kind: 'todos', size: 'lg' }])
    const card = cardOf(page, { kind: 'todos', size: 'lg' })
    const removeBtn = card.locator('ul > li').first().getByRole('button', { name: '删除这条待办' })
    const opacity = () => removeBtn.evaluate((el) => getComputedStyle(el).opacity)

    await expect.poll(opacity, '不悬停不聚焦时应是隐形的').toBe('0')
    await removeBtn.focus()
    await expect.poll(opacity, '聚焦后应随 :focus-within 显形').toBe('1')
    // 顺带确认键盘真能落到底板（焦点环来自全站 :focus-visible 基线，见 focus.spec.ts）
    await expect(removeBtn).toBeFocused()
  })

  test('T4 聚焦后 ⌥←/⌥→ 在前一/后一档间换档（S-6）并落库', async ({ page }) => {
    const combo: Combo = { kind: 'clock', size: 'md' }
    await mount(page, [combo])

    await cardOf(page, combo).focus()
    await page.keyboard.press('Meta+Alt+ArrowRight')
    await expect(cardOf(page, { kind: 'clock', size: 'lg' })).toHaveCount(1)
    await expectPersisted(page, (items) => items.map((i) => i.size), ['lg'])

    await page.keyboard.press('Meta+Alt+ArrowLeft')
    await expect(cardOf(page, combo)).toHaveCount(1)
    await expectPersisted(page, (items) => items.map((i) => i.size), ['md'])

    await page.reload()
    await expect(page.getByRole('banner')).toBeVisible()
    await expect(cardOf(page, combo)).toHaveCount(1)
  })

  test('T4 单档件（data-summary md）卡片表面不放浮标，⌥→ 也不换档（S-3）', async ({ page }) => {
    const combo: Combo = { kind: 'data-summary', size: 'md' }
    await mount(page, [combo])
    const card = cardOf(page, combo)
    // 宿主不在卡片上自绘任何控件：直接子节点里没有 button
    await expect(card.locator('> button')).toHaveCount(0)

    await card.focus()
    await page.keyboard.press('Meta+Alt+ArrowRight')
    await expect(card).toHaveAttribute('data-widget-size', 'md')
  })

  /**
   * 卡片表面零浮标（2026-10-07 定）：移除与换尺寸都不以 hover 显形的控件承载，
   * 右键菜单是这两件事的唯一鼠标入口（键盘另有 Delete 与 ⌥←/⌥→；菜单条目由 `widget.spec.ts` 钉）。
   * 这条腿量的是**悬停态**——浮标当年就是 `opacity-0` 藏在 hover 后面的，不悬停取样会自绿。
   */
  test('T4 悬停/聚焦多档件卡片：表面仍不长出任何宿主浮标', async ({ page }) => {
    const combo: Combo = { kind: 'clock', size: 'md' }
    await mount(page, [combo])
    const card = cardOf(page, combo)

    await expect(card.locator('> button')).toHaveCount(0)
    await card.hover()
    await expect(card.locator('> button')).toHaveCount(0)
    await card.focus()
    await expect(card.locator('> button')).toHaveCount(0)
  })

  test('T4 聚焦后 ⌘[ / ⌘] 改桌面顺序（自动流式件）', async ({ page }) => {
    const clock: Combo = { kind: 'clock', size: 'md' }
    const calendar: Combo = { kind: 'calendar', size: 'md' }
    await mount(page, [clock, calendar])

    // 播种序＝流式序：clock 在上、calendar 在下
    const firstY = async (l: Locator) => (await l.boundingBox())!.y
    expect(await firstY(cardOf(page, clock))).toBeLessThan(await firstY(cardOf(page, calendar)))

    await cardOf(page, calendar).focus()
    await expect(cardOf(page, calendar)).toBeFocused()
    await page.keyboard.press('Meta+[')
    await expect
      .poll(
        async () => (await firstY(cardOf(page, calendar))) < (await firstY(cardOf(page, clock))),
      )
      .toBe(true)
    await expectPersisted(page, (items) => items.map((i) => i.kindId), ['calendar', 'clock'])

    // 键盘路径的连续性：序列被重排后焦点必须还在这张卡上，否则用户得重新 Tab 一遍
    await expect(
      cardOf(page, calendar),
      '⌘[ 重排后焦点应仍留在被移动的卡片上（否则键盘路径被打断）',
    ).toBeFocused()

    await page.keyboard.press('Meta+]')
    await expect
      .poll(
        async () => (await firstY(cardOf(page, clock))) < (await firstY(cardOf(page, calendar))),
      )
      .toBe(true)
    await expectPersisted(page, (items) => items.map((i) => i.kindId), ['clock', 'calendar'])
  })

  test('T4 已手动摆放的件：⌘] 不改序并给原因（L-9）', async ({ page }) => {
    const clock: Combo = { kind: 'clock', size: 'md' }
    const calendar: Combo = { kind: 'calendar', size: 'md' }
    await mount(page, [clock, calendar])

    // ⌘⇧挪一格 ⇒ 该件脱离流式序列（L-5 首次手动时把全部实例的当前格位固化）
    await cardOf(page, clock).focus()
    await page.keyboard.press('Meta+Shift+ArrowLeft')
    await expect(cardOf(page, clock)).toHaveAttribute('data-widget-placed', 'manual')

    await page.keyboard.press('Meta+]')
    await expect(page.getByRole('status')).toContainText('已手动摆放')
    await expectPersisted(page, (items) => items.map((i) => i.kindId), ['clock', 'calendar'])
  })

  test('T4 ⌘⇧方向键按格挪动，reload 仍在同一格；越界一律拒绝（L-3/L-6/L-7 + T13 e2e 腿）', async ({
    page,
  }) => {
    const combo: Combo = { kind: 'clock', size: 'md' }
    await mount(page, [combo])
    const card = cardOf(page, combo)
    const origin = await card.boundingBox()
    expect(origin).toBeTruthy()

    // 向左一格：col+1（列序从视口右缘数）⇒ x 减一个 pitch
    await card.focus()
    await page.keyboard.press('Meta+Shift+ArrowLeft')
    await expect(card).toHaveAttribute('data-widget-placed', 'manual')
    const moved = await card.boundingBox()
    expect(Math.round(origin!.x - moved!.x)).toBe(PITCH)
    expect(Math.round(moved!.y - origin!.y)).toBe(0)
    await expectPersisted(page, (items) => items.map((i) => i.pos), [{ col: 1, row: 0 }])

    // 向下一格：row+1 ⇒ y 加一个 pitch
    await page.keyboard.press('Meta+Shift+ArrowDown')
    const down = await card.boundingBox()
    expect(Math.round(down!.y - moved!.y)).toBe(PITCH)
    await expectPersisted(page, (items) => items.map((i) => i.pos), [{ col: 1, row: 1 }])

    await page.reload()
    await expect(page.getByRole('banner')).toBeVisible()
    const restored = await card.boundingBox()
    expect(Math.round(restored!.x)).toBe(Math.round(down!.x))
    expect(Math.round(restored!.y)).toBe(Math.round(down!.y))
    await expect(card).toHaveAttribute('data-widget-placed', 'manual')

    // 回到最右列，再往右越界 ⇒ 拒绝（L-3：落点必须整块空），卡片原位不动
    await card.focus()
    await page.keyboard.press('Meta+Shift+ArrowUp')
    await page.keyboard.press('Meta+Shift+ArrowRight')
    await page.keyboard.press('Meta+Shift+ArrowRight')
    await expect(page.getByRole('alert')).toContainText('这里放不下')
    await expect(card).toHaveAttribute('data-widget-placed', 'manual')
    await expectPersisted(page, (items) => items.map((i) => i.pos), [{ col: 0, row: 0 }])
    const blocked = await card.boundingBox()
    // col 从视口右缘起算（L-1）：col 0 比 col 1 更靠右 ⇒ x 加一个 pitch，row 0 在上 ⇒ y 减一个
    expect(Math.round(blocked!.x)).toBe(Math.round(down!.x) + PITCH)
    expect(Math.round(blocked!.y)).toBe(Math.round(down!.y) - PITCH)
  })
})

/* ═══════════ §4.9 图形通道：批次 B 请的 12 个语义图标 ═══════════ */

/**
 * 判的是「画的是不是那一个字形」，不是「有没有画一个 svg」：`OsIcon` 对未登记的 name
 * 静默回落成 file 图标（`ICON_MAP[props.name] ?? ICON_MAP.file`），只数存在性的腿对它免检。
 * 期望形状直接取 lucide 自己的图标定义（同一份数据源，不另立像素快照）。
 */
function iconPathData(kebab: string): string[] {
  const src = readFileSync(
    join(process.cwd(), 'node_modules/lucide-vue-next/dist/esm/icons', `${kebab}.js`),
    'utf8',
  )
  // 只按 `d:` 取，不按 `{ d:` 取：这些定义文件被 prettier 折行过，长路径的对象是
  // `{\n d: "…"\n}` 的形状，要求左花括号紧邻会把整条 path 漏掉（漏掉的那条腿恒红恒绿都看不见）
  return [...src.matchAll(/\bd:\s*"([^"]+)"/g)].map((m) => m[1])
}

/** 元素集合内所有 svg 的 path `d`（文档序）；非 path 图元（rect/circle/line）两边都跳过 */
const pathsOf = (loc: Locator): Promise<string[]> =>
  loc.evaluateAll((els) =>
    els.flatMap((el) =>
      Array.from(el.querySelectorAll('svg path')).map((p) => p.getAttribute('d') ?? ''),
    ),
  )

test.describe('§4.9 双通道：system / control-center 的字形必须真是请来的那一个', () => {
  test.use({ viewport: { width: 1440, height: 1100 } })

  /** 四格由能力探测决定存否（无 getBattery 就没有 battery 格），自隐不算缺字形 */
  const SYSTEM_CELLS = {
    network: 'wifi',
    storage: 'hard-drive',
    memory: 'memory-stick',
    cpu: 'cpu',
  } as const

  test('system·md：每格图形与该格请的字形逐 path 相等，文字通道同时在（§4.9 不得只靠单一通道）', async ({
    page,
  }) => {
    const sys = { kind: 'system', size: 'md' } as const
    await mount(page, [sys])
    const card = cardOf(page, sys)

    const seen: string[] = []
    for (const [cell, icon] of Object.entries(SYSTEM_CELLS)) {
      const svg = card.locator(`[data-widget-cell="${cell}"] svg`)
      if (!(await svg.count())) continue
      expect(
        await pathsOf(svg),
        `${cell} 格画的不是 ${icon}（回落成 file 图标也在这里红）`,
      ).toEqual(iconPathData(icon))
      seen.push(icon)
    }
    // 三格（存储/内存/处理器）由 navigator 常量给出，Chromium 下必在；少了就是模板或白名单断了
    expect(
      seen.length,
      `只量到 ${seen.length} 格字形，system·md 至少该有 storage/内存/处理器三格`,
    ).toBeGreaterThanOrEqual(3)
    // 文字通道仍在：图形是补通道，不是替换
    await expect(card.locator('[data-widget-cell="cpu"]')).toContainText('核')
  })

  test('control-center：太阳/月亮分给两态、壁纸与语言的行首字形、lg 的重置钮带 rotate-ccw', async ({
    page,
  }) => {
    const cc = { kind: 'control-center', size: 'md' } as const
    const ccLg = { kind: 'control-center', size: 'lg' } as const
    await mount(page, [cc, ccLg])
    const card = cardOf(page, cc)

    for (const [label, icon] of [
      ['浅色', 'sun'],
      ['深色', 'moon'],
    ] as const) {
      const chip = card.getByRole('button', { name: label, exact: true })
      await expect(chip).toBeVisible()
      // 取第一枚 svg：选中态的钮里还有第二枚 `check`（模板顺序字形在前、勾在后），整串比会把它算进来
      expect(await pathsOf(chip.locator('svg').first()), `${label} 档的字形不是 ${icon}`).toEqual(
        iconPathData(icon),
      )
    }
    // 行首字形挂在标签上，不挂在选择器里：同一行三个壁纸钮共用一个形状才有信息量
    for (const [row, icon] of [
      ['壁纸', 'image'],
      ['语言', 'languages'],
    ] as const) {
      const label = card.getByText(row, { exact: true })
      expect(await pathsOf(label.locator('svg')), `${row} 行的行首字形不是 ${icon}`).toEqual(
        iconPathData(icon),
      )
    }
    // 重置钮只在 lg 存在
    const reset = cardOf(page, ccLg).getByRole('button', { name: '重置 Dock', exact: true })
    await expect(reset).toBeVisible()
    expect(await pathsOf(reset.locator('svg'))).toEqual(iconPathData('rotate-ccw'))
  })
})

/* ═══════════ §4.2 规则 1/5：实例域数据各写各的，删件不删数据 ═══════════ */

test.describe('§4.2 实例域：同 kind 两张卡走真实添加路径，正文互不串台、删一张不动另一张', () => {
  test.use({ viewport: { width: 1440, height: 1000 } })

  const notes = (page: Page) => page.locator('[data-widget-kind="sticky-note"]')
  const notePath = (id: string) => `/我的数据/sticky-note/${id}.json`
  /** 实例域正文按实例 id 取，不按 DOM 序号取：reload 后两张卡的先后不是判据 */
  const textOf = (page: Page, id: string) =>
    page.locator(`[data-widget-id="${id}"]`).getByRole('textbox')

  async function addStickyNoteLg(page: Page): Promise<void> {
    await page.mouse.click(320, 620, { button: 'right' })
    await page.getByRole('button', { name: '添加小组件' }).click()
    const row = page.locator('[data-widget-kind-row="sticky-note"]')
    await row.getByRole('button', { name: '添加', exact: true }).click()
    await row.locator('[data-widget-size-chooser]').getByRole('radio', { name: '大' }).click()
    await row.getByRole('button', { name: '确定' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }

  test('添加两次 → 两个实例 id → 各写各的：DOM 与两份 VFS 路径同时分开，reload 两份都在', async ({
    page,
  }) => {
    await gotoShell(page)
    await addStickyNoteLg(page)
    await expect(notes(page)).toHaveCount(1)
    await addStickyNoteLg(page)
    await expect(notes(page)).toHaveCount(2)

    const ids = await notes(page).evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-widget-id') ?? ''),
    )
    expect(new Set(ids).size, `两张同 kind 的卡共用了实例 id：${ids.join(' / ')}`).toBe(2)

    await textOf(page, ids[0]).fill('第一张独有文本')
    await textOf(page, ids[1]).fill('第二张独有文本')
    await expect(textOf(page, ids[0])).toHaveValue('第一张独有文本')
    await expect(textOf(page, ids[1])).toHaveValue('第二张独有文本')

    // scope: 'instance' 的落点必须含实例 id（§4.2 规则 1），两张各占一个文件
    await expect
      .poll(
        async () => {
          const kv = await readKv(page, [FS_KEY])
          return ids.map((id) => JSON.parse(fsNodeContent(kv, notePath(id)) ?? '{}').text ?? null)
        },
        { timeout: 15_000, intervals: [200, 500, 800] },
      )
      .toEqual(['第一张独有文本', '第二张独有文本'])

    await page.reload()
    await expect(notes(page)).toHaveCount(2)
    await expect(textOf(page, ids[0])).toHaveValue('第一张独有文本')
    await expect(textOf(page, ids[1])).toHaveValue('第二张独有文本')
  })

  test('移除其中一张：另一张正文分毫不动，被删那张的数据文件仍在（规则 5 删件不删数据）', async ({
    page,
  }) => {
    await gotoShell(page)
    await addStickyNoteLg(page)
    await addStickyNoteLg(page)
    await expect(notes(page)).toHaveCount(2)
    const ids = await notes(page).evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-widget-id') ?? ''),
    )
    await textOf(page, ids[0]).fill('留下来的那张')
    await textOf(page, ids[1]).fill('要被删掉的那张')
    await expect
      .poll(async () => {
        const kv = await readKv(page, [FS_KEY])
        return JSON.parse(fsNodeContent(kv, notePath(ids[1])) ?? '{}').text ?? null
      })
      .toBe('要被删掉的那张')

    const doomed = page.locator(`[data-widget-id="${ids[1]}"]`)
    await doomed.click({ button: 'right' })
    await page.locator('[data-shell-menu]').getByRole('button', { name: '移除' }).click()
    await page.getByRole('button', { name: '确定' }).click()
    await expect(notes(page)).toHaveCount(1)

    // 另一张不受影响：DOM 与它自己的数据文件都保持原值
    await expect(textOf(page, ids[0])).toHaveValue('留下来的那张')
    // 被删实例的数据**不跟着删**（规则 5：它成了孤儿，出口在小组件中心的「数据」段，单测已覆盖清除动作）
    const after = await readKv(page, [FS_KEY])
    expect(JSON.parse(fsNodeContent(after, notePath(ids[1])) ?? '{}').text).toBe('要被删掉的那张')
    expect(JSON.parse(fsNodeContent(after, notePath(ids[0])) ?? '{}').text).toBe('留下来的那张')

    await page.reload()
    await expect(notes(page)).toHaveCount(1)
    await expect(textOf(page, ids[0])).toHaveValue('留下来的那张')
  })
})
