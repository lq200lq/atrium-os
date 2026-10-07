import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { h, type VNode } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import FeedbackHost from '@/shell/FeedbackHost.vue'
import WidgetFrame from '@/shell/WidgetFrame.vue'
import WidgetPreview from '@/components/WidgetPreview.vue'
import { translate } from '@/i18n'
import { useNotification } from '@/kernel/stores/notification'
import { useVfs } from '@/kernel/stores/vfs'
import {
  useWidgetRegistry,
  type WidgetManifest,
  type WidgetSize,
} from '@/kernel/stores/widgetRegistry'
import { sanitizeConfig, useWidgets } from '@/kernel/stores/widgets'
import { baseName, parentOf } from '@/kernel/fs/types'
import { previewSampleOf } from '@/kernel/widget/previewSamples'
import { JSON_MIME, widgetDataPath } from '@/kernel/widget/widgetData'
import { EVENTS_KEY, TASKS_KEY, sampleEvents, sampleTasks } from '@/kernel/widget/taskSchedule'

/**
 * §9 T6 的**前半句**：「同 schema 默认值下，预览容器与桌面卡片首屏 DOM 结构同构」。
 * 后半句（沙箱内 write/patch 不写 VFS、useWidgetTick 不注册订阅）已经在
 * `tests/unit/widget-console.test.ts` 的「预览沙箱零副作用」用例里钉住，这里不重跑。
 *
 * 两处挂的是注册表里同一个 `markRaw(defineAsyncComponent(entry))`（`widgetRegistry.register`），
 * 差别只有上下文：真实例走 VFS + 宿主排程，沙箱吃件自带样例、写是 no-op、不注册心跳。
 * 所以结构一旦分叉，管理面给用户看的就是**另一件**小组件——添加完发现桌面不是那样（§4.8 A-13）。
 *
 * 判据：从两个宿主共用的 `[data-widget-content]` 往下，把 DOM 约成骨架——每行只有「深度 + 标签名」，
 * 文本与属性值一律丢掉。样例文案与真数据本就不同字（§8 偏差 4/5：样例走 titleKey/textKey 进语言包），
 * 拿文本比会把「同构」误判成「同文案」。兄弟节点不折叠：喂的是同一份数据，行数本身也是结构。
 *
 * 宿主 chrome 刻意不在这条断言里，并记下实测差异：桌面卡片是 `section[role=group][tabindex=0]`，
 * 表面不放任何宿主自绘浮标（移除/换尺寸都从右键菜单走，`widget-frame.test.ts` 有「卡片上没有按钮」那条腿），
 * 预览容器是 `div` + 「预览」角标 + 整块 `aria-hidden`
 * 且 `pointer-events-none`（A-13）——两处本就不该一样，所以比较根收在内容 wrapper 之内。
 * 内容 wrapper 本身（`div[data-widget-content].h-full` + 同一内边距档类名）两处各只有一个，
 * 类名逐字比一条，管住「同一件在两个宿主里内边距档不同」这类真失真（H-7）。
 */

const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))

vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value)
  }),
}))

/** 内置件全量：glob 收真实 manifest，新增一件不必改这份测试（漏了「同一份数据」的口径它会自己红） */
const manifests = Object.values(
  import.meta.glob('../../src/widgets/*/manifest.ts', {
    eager: true,
    import: 'manifest',
  }) as Record<string, WidgetManifest>,
).sort((a, b) => a.id.localeCompare(b.id))

/** 逐件记下「桌面侧那一份数据从哪儿来」，写进标题：报告才读得出这条不是两处空态互相印证 */
const DATA_NOTE: Record<string, string> = {
  calendar: 'events.json＝sampleEvents()（日期锚在今天）',
  clock: '无自有数据，只吃 schema 默认配置',
  'control-center': '读 theme/settings store，两宿主同一份',
  'data-summary': 'orgSeed 纯模块，preview.json 是它的誊本',
  'notification-summary': 'preview.json 的 3 条＋未读 2 喂进通知 store',
  'recent-files': '两宿主都直接读真实 VFS 节点表',
  'sticky-note': 'instance 域文件按实例 id 落 preview.json 那份',
  storage: '桌面侧 estimate 桩成件自带 SAMPLE_QUOTA 同一组数字',
  system: '异步浏览器读两处都不可得（见下条注释）',
  todos: 'tasks.json＝sampleTasks()',
}

const BUILT_IN_IDS = [
  'calendar',
  'clock',
  'control-center',
  'data-summary',
  'notification-summary',
  'recent-files',
  'sticky-note',
  'storage',
  'system',
  'todos',
]

const RECT = { x: 0, y: 0, w: 344, h: 160 }

/** `src/widgets/storage/App.vue` 的 SAMPLE_QUOTA：第二份持有，件改了样例而桌面数字没跟上时这条会指出来源 */
const SAMPLE_QUOTA = { usage: 148 * 1024 ** 3, quota: 512 * 1024 ** 3 }

/** 每次挂载配一个游离节点，查询根按 wrapper 反查：两宿主同时在场也不串味，卸载后不留残影 */
const mounted = new Map<VueWrapper, HTMLElement>()

function stubAllInView() {
  class AlwaysInViewIntersectionObserver {
    private readonly cb: IntersectionObserverCallback
    constructor(cb: IntersectionObserverCallback) {
      this.cb = cb
    }
    observe(target: Element): void {
      this.cb(
        [{ target, isIntersecting: true }] as unknown as IntersectionObserverEntry[],
        this as unknown as IntersectionObserver,
      )
    }
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }
  vi.stubGlobal('IntersectionObserver', AlwaysInViewIntersectionObserver)
}

/**
 * 浏览器读分两类处理——这是本条最容易糊过去的地方（§4.8 屏蔽 ① 的实际口径）：
 * - **同步读**（`navigator.onLine` / `deviceMemory` / `hardwareConcurrency`）预览里照跑，
 *   两处读同一个环境值，天然一致；这里给固定值只是为了让卡片真有内容可比。
 * - **异步读**（`navigator.storage.estimate` / `getBattery`）件在预览里压根不发起
 *   （`system/App.vue`、`storage/App.vue` 的 `onMounted(() => { if (preview) return … })`），
 *   件只补一个「样例形态」。于是 `storage` 的桌面侧必须把 estimate 桩成 SAMPLE_QUOTA 同一组数字
 *   才算同一份数据；`system` 没有样例形态可补（它的 preview.json 是 `{}`），桌面侧就让这两个 API
 *   不可得——它两格都不画，两处剩下同一些同步读格子。这是「沙箱不做异步读」的既有偏差（§8 偏差 5），
 *   不是本条要证的形状失真，所以按不可得处理并在此记录，而不是拿桩把预览也喂成有数据。
 * - `getBattery` 两处一律不可得：真机有没有电池不该决定这条的绿红。
 */
function setBrowserReads(kindId: string) {
  const nav = globalThis.navigator as Navigator & Record<string, unknown>
  Object.defineProperty(nav, 'onLine', { value: true, configurable: true })
  Object.defineProperty(nav, 'deviceMemory', { value: 8, configurable: true })
  Object.defineProperty(nav, 'hardwareConcurrency', { value: 8, configurable: true })
  Object.defineProperty(nav, 'storage', {
    value: kindId === 'storage' ? { estimate: async () => SAMPLE_QUOTA } : undefined,
    configurable: true,
  })
  Object.defineProperty(nav, 'getBattery', { value: undefined, configurable: true })
}

/** 逐级补齐父目录：VFS 的 writeFile 不建父目录（与 useWidgetData 的 ensureDirs 同一写法） */
function ensureDirs(path: string) {
  const vfs = useVfs()
  const chain: string[] = []
  let cur = parentOf(path)
  while (cur && cur !== '/' && !vfs.byPath(cur)) {
    chain.unshift(cur)
    cur = parentOf(cur)
  }
  for (const dir of chain) {
    if (!vfs.byPath(dir)) vfs.mkdir(parentOf(dir), baseName(dir))
  }
}

function putJson(path: string, payload: unknown) {
  const vfs = useVfs()
  const json = JSON.stringify(payload)
  if (vfs.byPath(path)) {
    vfs.updateContent(path, json)
    return
  }
  ensureDirs(path)
  vfs.writeFile(parentOf(path), baseName(path), json, JSON_MIME)
}

/**
 * 件在预览里读到的那一份数据。两条来源（§4.8 屏蔽 ①）：
 * `preview.json` 里与 `manifest.data.key` 同名的键；日期敏感的两件不在 json 里
 * （`previewSamples.ts` 头注：静态日期会被「今天」这一档筛选滤空），由件自带
 * `sampleTasks()` / `sampleEvents()`。桌面侧喂的就是这两个构造函数的返回——逐字同源。
 */
function samplePayloadOf(manifest: WidgetManifest): unknown {
  const key = manifest.data?.key ?? manifest.id
  const own = previewSampleOf(manifest.id)?.[key]
  if (own !== undefined) return own
  if (key === TASKS_KEY) return sampleTasks()
  if (key === EVENTS_KEY) return sampleEvents()
  return undefined
}

/** 共享域文件与实例无关，一次喂好；实例域文件路径含实例 id，只能在 add 之后补 */
function seedSharedData() {
  for (const manifest of manifests) {
    const spec = manifest.data
    if (!spec || spec.scope !== 'shared') continue
    const payload = samplePayloadOf(manifest)
    if (payload === undefined) continue
    putJson(widgetDataPath(spec, { kindId: manifest.id, instanceId: '' }), payload)
  }
}

function seedInstanceData(manifest: WidgetManifest, instanceId: string) {
  const spec = manifest.data
  if (!spec || spec.scope !== 'instance') return
  const payload = samplePayloadOf(manifest)
  if (payload === undefined) return
  putJson(widgetDataPath(spec, { kindId: manifest.id, instanceId }), payload)
}

/**
 * 通知摘要不读 VFS：预览吃 `preview.json` 的 items/unread，桌面读 `notification` store，
 * 于是把同一批标题推进 store 并把未读数凑成样例那个值——否则两处的行数与数字都不同，
 * 这条就退化成「3 行 vs 1 行也判同构」的空转。
 */
function seedNotifications() {
  const sample = previewSampleOf('notification-summary')?.['notification-summary'] as
    { unread?: number; items?: { titleKey?: string; title?: string }[] } | undefined
  const notif = useNotification()
  for (const item of sample?.items ?? []) {
    notif.push(item.title ?? translate(item.titleKey ?? ''), '沙箱外的同一份内容')
  }
  const unread = sample?.unread ?? notif.items.length
  notif.items.forEach((item, index) => {
    item.read = index >= unread
  })
}

/** 每件挂到各自的游离节点：两宿主同时在场，查询根必须互不串味 */
function attach(render: () => VNode | VNode[]): VueWrapper {
  const host = document.createElement('div')
  const wrapper = mount(FeedbackHost, { slots: { default: render }, attachTo: host })
  mounted.set(wrapper, host)
  return wrapper
}

/** 摘掉一侧：预览槽在 onBeforeUnmount 里归还，不摘就会在逐件逐档的循环里撞到并发上限 4 */
function unmountOne(wrapper: VueWrapper): void {
  const host = mounted.get(wrapper)
  wrapper.unmount()
  mounted.delete(wrapper)
  host?.remove()
}

function mountDesktop(manifest: WidgetManifest, size: WidgetSize): VueWrapper {
  const widgets = useWidgets()
  const added = widgets.add(manifest.id, size)
  if (!added.ok) throw new Error(`前置失败：${manifest.id}·${size} 实例未建立`)
  seedInstanceData(manifest, added.instance.id)
  return attach(() => h(WidgetFrame, { instanceId: added.instance.id, rect: RECT }))
}

function mountPreview(kindId: string, size: WidgetSize): VueWrapper {
  return attach(() => h(WidgetPreview, { kindId, size }))
}

/** 内容 wrapper：两个宿主各自只该有一个（§4.6 材质与 §4.8 预览共用同一条内容契约） */
function contentOf(wrapper: VueWrapper, side: string): Element {
  const host = mounted.get(wrapper)
  if (!host) throw new Error('前置失败：这一侧没有挂载点')
  const found = Array.from(host.querySelectorAll('[data-widget-content]'))
  if (found.length !== 1) {
    throw new Error(`前置失败：${side}侧的 [data-widget-content] 有 ${found.length} 个`)
  }
  return found[0]!
}

/**
 * 等异步件落地：没等就取骨架，会把 Suspense 的加载占位比成卡片内容
 * （两处的占位块本就不同形——桌面是 OsSkeleton、预览是一块 pulse——所以漏等只会红，不会假绿）。
 */
async function settle(wrapper: VueWrapper, side: string, label: string): Promise<Element> {
  let el: Element = contentOf(wrapper, side)
  await vi.waitFor(
    () => {
      el = contentOf(wrapper, side)
      expect(el.querySelector('[aria-busy="true"]'), `${label}：${side}侧异步件没落地`).toBeNull()
      expect(el.firstElementChild, `${label}：${side}侧没画出内容节点`).toBeTruthy()
    },
    { timeout: 3_000 },
  )
  return el
}

/** 骨架：一行一个节点，只有「深度\t标签名」——文本节点与属性值全丢 */
function skeletonOf(root: Element): string[] {
  const out: string[] = []
  const walk = (el: Element, depth: number) => {
    out.push(`${depth}\t${el.tagName.toLowerCase()}`)
    for (const child of Array.from(el.children)) walk(child, depth + 1)
  }
  for (const child of Array.from(root.children)) walk(child, 1)
  return out
}

/** 首个分叉行给局部窗口，失败信息带行数与深度：fixme 标题要能直接抄实测数字 */
function shapeDiff(desktop: string[], preview: string[]): string | null {
  const same = desktop.length === preview.length && desktop.every((l, i) => l === preview[i])
  if (same) return null
  const at = desktop.findIndex((l, i) => l !== preview[i])
  const from = Math.max(0, at)
  const atLine = at === -1 ? desktop.length : at
  const window = (arr: string[]) =>
    arr
      .slice(from, from + 4)
      .map((l) => l.replace('\t', ' '))
      .join(' → ') || '（无）'
  return `第 ${atLine} 行起分叉（桌面 ${desktop.length} 行 / 预览 ${preview.length} 行）｜桌面 ${window(desktop)}｜预览 ${window(preview)}`
}

async function parityFailures(manifest: WidgetManifest): Promise<string[]> {
  const failures: string[] = []
  for (const size of manifest.widget.sizes) {
    setBrowserReads(manifest.id)
    const desktop = mountDesktop(manifest, size)
    const preview = mountPreview(manifest.id, size)
    const label = `${manifest.id}·${size}`
    const d = await settle(desktop, '桌面侧', label)
    const p = await settle(preview, '预览侧', label)

    const diff = shapeDiff(skeletonOf(d), skeletonOf(p))
    if (diff) failures.push(`${label}：${diff}`)

    const dClass = Array.from(d.classList).sort().join(' ')
    const pClass = Array.from(p.classList).sort().join(' ')
    if (dClass !== pClass) {
      failures.push(`${label}：内容 wrapper 类名不同｜桌面「${dClass}」｜预览「${pClass}」`)
    }

    unmountOne(desktop)
    unmountOne(preview)
  }
  return failures
}

describe('T6 预览与桌面首屏同构（§9 T6 前半 / §4.8 A-13）', () => {
  beforeAll(async () => {
    // 件是 `() => import('./App.vue')`：先把模块图热一遍，否则首轮挂载会撞上真实 I/O
    await Promise.all(manifests.map((manifest) => manifest.entry()))
  })

  beforeEach(async () => {
    idbStore.clear()
    setActivePinia(createPinia())
    stubAllInView()
    // 桌面侧要有真内容：走平台自己的还原路径（无存档 → seed 出 /我的文件 那棵树 → ready）
    await useVfs().init()
    for (const manifest of manifests) useWidgetRegistry().register(manifest)
    seedSharedData()
    seedNotifications()
  })

  afterEach(() => {
    // 逐件逐档循环里已经摘过一轮；这里兜住中途断言失败留下的挂载，否则预览并发槽会被吃满
    for (const wrapper of [...mounted.keys()]) unmountOne(wrapper)
    vi.unstubAllGlobals()
  })

  it('T6 覆盖面：十个内置件全在册，且每件都写明了「同一份数据」从哪儿来', () => {
    expect(manifests.map((m) => m.id)).toEqual(BUILT_IN_IDS)
    for (const manifest of manifests) {
      expect(useWidgetRegistry().byId(manifest.id), `${manifest.id} 未注册`).toBeTruthy()
      expect(DATA_NOTE[manifest.id], `${manifest.id} 缺「同一份数据」的口径说明`).toBeTruthy()
    }
  })

  it('T6 前置不空转：桌面侧确实读到了喂进去的那一份（否则两处都在画空态，同构是自证）', async () => {
    const probes: { id: string; size: WidgetSize; expect: string }[] = [
      { id: 'todos', size: 'md', expect: translate('widgets.sample.task1') },
      { id: 'calendar', size: 'lg', expect: translate('widgets.sample.event1') },
      { id: 'sticky-note', size: 'md', expect: translate('widgets.sample.note') },
      { id: 'notification-summary', size: 'md', expect: translate('widgets.sample.noticeBackup') },
      // estimate 桩生效才会画环上的百分比（缺桩时 md 档只剩条形区，结构本身就会分叉）
      { id: 'storage', size: 'md', expect: '29%' },
      // recent-files 不读件数据文件，读的是 VFS 节点表：seed 树里那份要看得见
      { id: 'recent-files', size: 'md', expect: '项目汇报.pptx' },
    ]
    for (const probe of probes) {
      const manifest = useWidgetRegistry().byId(probe.id)!
      setBrowserReads(probe.id)
      const desktop = mountDesktop(manifest, probe.size)
      const content = await settle(desktop, '桌面侧', `${probe.id}·${probe.size}`)
      expect(content.textContent, `${probe.id} 桌面侧没读到 ${probe.expect}`).toContain(
        probe.expect,
      )
      unmountOne(desktop)
    }
  })

  for (const manifest of manifests) {
    it(`T6 ${manifest.name}（${manifest.widget.sizes.join('/')} 档逐一）：同 schema 默认值 + 同一份数据（${DATA_NOTE[manifest.id]}）下预览容器与桌面卡片首屏骨架同构`, async () => {
      // 「同 schema 默认值」是前提不是自然事实：沙箱侧配置就是 createPreviewWidgetContext 里的
      // sanitizeConfig(undefined, manifest)，桌面侧由 widgets.add() 给同一个表达式——
      // 两处不等就说明比的是两件不同配置下的卡片，同构结论没有意义。
      const widgets = useWidgets()
      const probe = widgets.add(manifest.id)
      if (!probe.ok) throw new Error(`前置失败：${manifest.id} 实例未建立`)
      expect(probe.instance.config, `${manifest.id}：两处 schema 默认值不同`).toEqual(
        sanitizeConfig(undefined, manifest),
      )
      widgets.remove(probe.instance.id)

      const failures = await parityFailures(manifest)
      expect(failures, `${manifest.id}：预览与桌面不同构`).toEqual([])
    })
  }
})
