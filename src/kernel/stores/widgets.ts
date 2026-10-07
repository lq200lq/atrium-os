import { defineStore } from 'pinia'
import { idbGet, idbSet } from '../fs/idb'
import { useSession } from './session'
import {
  useWidgetRegistry,
  type WidgetConfigField,
  type WidgetManifest,
  type WidgetSize,
} from './widgetRegistry'
import { useWidgetRuntime } from './widgetRuntime'
import type { WidgetCell } from '../widget/geometry'
import { persistBoundary } from './persistHelper'

const WIDGETS_KEY = 'widgets-v1'
const KINDS_KEY = 'widget-kinds-v1'

/** 配置写入的合并窗口：与 windowManager 的 400ms 各属自己的子系统（那边合并几何回写） */
const CONFIG_PERSIST_DEBOUNCE = 300

export type WidgetConfigValues = Record<string, string | number | boolean>

/**
 * 摆放状态。`pos` 是**整数网格坐标**（col 从视口右缘数，见 geometry.ts L-1/L-7），
 * null = 参与右锚定自动流式（缺省态）。首次手动拖拽时把全部实例的当前自动位置固化进来（C-④）。
 */
export interface WidgetInstance {
  /** 实例 id（同一 kind 可多实例），与 kindId 区分 */
  id: string
  kindId: string
  size: WidgetSize
  /** null = 参与右锚定自动流式布局 */
  pos: WidgetCell | null
  /** 每实例配置，键取自 manifest.config；缺省 = 全部取 schema default */
  config?: WidgetConfigValues
  /** 创建时间戳。摆放顺序的权威是**数组下标**（§4.7 第 1 步），addedAt 只做元数据 */
  addedAt: number
}

export type AddWidgetResult =
  | { ok: true; instance: WidgetInstance; reused: boolean }
  | { ok: false; reason: 'unknown-kind' | 'bad-size' }

/**
 * kind 的用户级生命周期。缺省即「已安装 + 已启用」——内置件开箱在架上，
 * 因此这套状态不影响既有桌面与首启种子。
 */
export interface WidgetKindState {
  /** false = 已卸载：不在「小组件」列表的可添加集里，其实例也已一并摘掉 */
  installed: boolean
  /** false = 已停用：实例与配置都留着，只是桌面不渲染（停用 ≠ 删除） */
  enabled: boolean
}

const KIND_DEFAULT: WidgetKindState = { installed: true, enabled: true }

/**
 * 落库快照：还原成纯数据再交给 IDB。
 * `Array.prototype.filter` 之类**重建**过的数组，元素是响应式代理，而 IDB 的结构化克隆
 * 不认代理（DataCloneError，还会被 persist 的 catch 吞成一行 warn）——落库前统一剥一层。
 */
export function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** 实例 id 冲突时加数字后缀（与 webApps.uniqueId 同策略） */
function uniqueId(kindId: string, taken: (id: string) => boolean): string {
  const base = `wgt-${kindId}`
  if (!taken(base)) return base
  for (let n = 2; n < 1000; n++) if (!taken(`${base}-${n}`)) return `${base}-${n}`
  return `wgt-${kindId}-${Date.now()}`
}

function clampNumber(raw: number, field: WidgetConfigField): number {
  let value = raw
  if (typeof field.min === 'number' && value < field.min) value = field.min
  if (typeof field.max === 'number' && value > field.max) value = field.max
  // 步长只在「明显越界」时吸附，避免把用户输入的合法值（如 3）拽到 step 网格上
  if (typeof field.step === 'number' && field.step > 0 && Math.abs(value % field.step) > 1e-9) {
    value = Math.round(value / field.step) * field.step
    if (typeof field.min === 'number') value = Math.max(value, field.min)
    if (typeof field.max === 'number') value = Math.min(value, field.max)
  }
  return value
}

function optionValues(field: WidgetConfigField): string[] {
  return (field.options ?? []).map((o) => (typeof o === 'string' ? o : o.value))
}

/** 只保留 schema 声明的键并收敛到取值域，缺失的取 default；无有效键则返回 undefined（不落空对象） */
export function sanitizeConfig(
  raw: unknown,
  manifest: WidgetManifest | null | undefined,
): WidgetConfigValues | undefined {
  const source = (raw ?? {}) as Record<string, unknown>
  const out: WidgetConfigValues = {}
  const fallback = (field: WidgetConfigField) => {
    const d = field.default
    if (typeof d === 'string' || typeof d === 'number' || typeof d === 'boolean') out[field.key] = d
  }
  for (const field of manifest?.config ?? []) {
    const value = source[field.key] ?? field.default
    if (value === undefined || value === null) continue
    if (field.type === 'number') {
      const n = Number(value)
      if (Number.isFinite(n)) out[field.key] = clampNumber(n, field)
      else fallback(field)
    } else if (field.type === 'boolean') {
      out[field.key] = value === true || value === 'true'
    } else if (field.type === 'select') {
      const clean = String(value).trim()
      // 取值必须在候选里：手改 IDB 或件写错键不该把桌面变成空标签
      if (optionValues(field).includes(clean)) out[field.key] = clean
      else fallback(field)
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      out[field.key] = value
    }
  }
  return Object.keys(out).length ? out : undefined
}

function validCell(raw: unknown): WidgetCell | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  if (!Number.isInteger(p.col) || !Number.isInteger(p.row)) return null
  const col = p.col as number
  const row = p.row as number
  if (col < 0 || row < 0) return null
  return { col, row }
}

export const useWidgets = defineStore('widgets', {
  state: () => ({
    items: [] as WidgetInstance[],
    /** kind 级生命周期：只记非缺省项（IDB `widget-kinds-v1`） */
    kinds: {} as Record<string, WidgetKindState>,
    /** 件内当前选中项（月历的日期、待办的筛选），只活在本次会话，供下钻 payload 消费，不落库 */
    selected: {} as Record<string, unknown>,
    /** 配置写入的防抖计时器（不进快照，也不参与响应式语义） */
    persistTimers: {} as Record<string, ReturnType<typeof setTimeout>>,
  }),
  getters: {
    byId: (state) => (id: string) => state.items.find((i) => i.id === id),
    byKind: (state) => (kindId: string) => state.items.filter((i) => i.kindId === kindId),
    /** kind 生命周期；没有记录即缺省（已安装 + 已启用） */
    kindState:
      (state) =>
      (kindId: string): WidgetKindState =>
        state.kinds[kindId] ?? { ...KIND_DEFAULT },
    /**
     * 渲染序＝**数组下标**（§4.7 第 1 步：顺序权威从 addedAt 换成下标，move() 即改下标）。
     * 过滤条件不变：kind 仍注册着、当前会话可访问、且未被卸载。
     */
    renderable(state): WidgetInstance[] {
      const registry = useWidgetRegistry()
      const session = useSession()
      return state.items.filter((i) => {
        const manifest = registry.byId(i.kindId)
        if (!manifest || !session.canAccess(manifest)) return false
        return (state.kinds[i.kindId] ?? KIND_DEFAULT).installed
      })
    },
    /** 桌面真正可见的实例：在 renderable 之上再叠一层 kind 启用态（停用只是不显示） */
    visible(): WidgetInstance[] {
      return this.renderable.filter((i) => (this.kinds[i.kindId] ?? KIND_DEFAULT).enabled)
    },
    /** 手动摆放过的实例（L-9：它们脱离流式序列，排序动作对其置灰） */
    isManual: (state) => (id: string) => Boolean(state.items.find((i) => i.id === id)?.pos),
  },
  actions: {
    add(kindId: string, size?: WidgetSize, config?: WidgetConfigValues): AddWidgetResult {
      const manifest = useWidgetRegistry().byId(kindId)
      if (!manifest) return { ok: false, reason: 'unknown-kind' }
      const spec = manifest.widget
      const want = size ?? spec.defaultSize ?? spec.sizes[0]
      if (!spec.sizes.includes(want)) return { ok: false, reason: 'bad-size' }

      if (manifest.singleton) {
        const existing = this.items.find((i) => i.kindId === kindId)
        if (existing) return { ok: true, instance: existing, reused: true }
      }

      const instance: WidgetInstance = {
        id: uniqueId(kindId, (id) => this.items.some((i) => i.id === id)),
        kindId,
        size: want,
        pos: null, // 新添加走自动流式（L-5）；用户拖过之后才写入格位
        config: config ? sanitizeConfig(config, manifest) : sanitizeConfig(undefined, manifest),
        addedAt: Date.now(),
      }
      this.items.push(instance)
      void this.persist('添加')
      return { ok: true, instance, reused: false }
    },

    /**
     * 移除实例：小组件不进窗口体系，因此没有活窗口要关、也没有注册表要注销
     * （kind 是注册表级的，不属于某个实例）。数据不在此列——删件不删数据（§4.2 规则 5）。
     */
    remove(id: string) {
      const at = this.items.findIndex((i) => i.id === id)
      if (at === -1) return
      this.items.splice(at, 1)
      delete this.selected[id]
      // 运行态跟着**实例**收尾，不跟着卡片收尾：视口变窄时卡片也会离开 DOM，
      // 那一次的溢出记录必须留着，否则「+N 个未显示」会被自己的卸载抹掉（§4.10）
      useWidgetRuntime().forget(id)
      void this.persist('移除')
    },

    setSize(id: string, size: WidgetSize) {
      const instance = this.items.find((i) => i.id === id)
      if (!instance) return
      const manifest = useWidgetRegistry().byId(instance.kindId)
      if (!manifest || !manifest.widget.sizes.includes(size)) return
      instance.size = size
      void this.persist('改尺寸')
    },

    /** 拖拽摆放的提交口：只有落定才写一次（跟手每帧只改 transform，不落库）。改尺寸走上面的 `setSize`——离散即时生效，2026-10-07 起没有拖角手势 */
    setPosition(id: string, pos: WidgetCell | null) {
      const instance = this.items.find((i) => i.id === id)
      if (!instance) return
      instance.pos = pos ? { col: Math.max(0, pos.col), row: Math.max(0, pos.row) } : null
      void this.persist(pos ? '摆放' : '退回自动摆放')
    },

    /** 撤销手动态（L-9 的显式出口）：清 pos 即回到自动流式 */
    releasePosition(id: string) {
      this.setPosition(id, null)
    },

    /** 首次手动拖拽的一次性迁移（台账 C-④）：把全部实例的当前自动格位固化，只落库一次 */
    pinPositions(cells: Record<string, WidgetCell>) {
      let touched = false
      for (const instance of this.items) {
        const cell = cells[instance.id]
        if (!cell || instance.pos) continue
        instance.pos = { col: cell.col, row: cell.row }
        touched = true
      }
      if (touched) void this.persist('固化摆放')
    },

    /** 改桌面顺序：在流式视图里移到 toIndex，非流式槽位保持原相对位置（L-9） */
    move(id: string, toIndex: number) {
      const view = this.renderable
      const from = view.findIndex((i) => i.id === id)
      if (from === -1) return
      const to = Math.max(0, Math.min(toIndex, view.length - 1))
      if (from === to) return
      const next = view.slice()
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      // items 里可能夹着不可渲染的实例（kind 已卸载等），按视图顺序逐位回填，其余原位不动
      const viewIds = new Set(view.map((i) => i.id))
      let k = 0
      this.items = this.items.map((i) => (viewIds.has(i.id) ? next[k++] : i))
      void this.persist('排序')
    },

    updateConfig(id: string, config: WidgetConfigValues) {
      const instance = this.items.find((i) => i.id === id)
      if (!instance) return
      const manifest = useWidgetRegistry().byId(instance.kindId)
      if (!manifest) return
      instance.config = sanitizeConfig(config, manifest)
      this.persistDebounced('改配置')
    },

    setSelected(id: string, value: unknown) {
      this.selected[id] = value
    },

    /** 安装 kind：回到货架（缺省即安装态，写记录只为把曾经的卸载状态翻回来） */
    install(kindId: string) {
      if (!useWidgetRegistry().byId(kindId)) return
      this.kinds[kindId] = { installed: true, enabled: true }
      void this.persistKinds('安装')
    },

    /**
     * 卸载 kind：连带摘掉它的全部实例（同 webApps.remove 连带关窗的口径），并记为未安装。
     * 可逆——kind 仍在构建期注册表里，随时能装回来（装回后是空桌面，实例不复活）。
     */
    uninstall(kindId: string) {
      const gone = this.items.filter((i) => i.kindId === kindId).map((i) => i.id)
      this.items = this.items.filter((i) => i.kindId !== kindId)
      this.kinds[kindId] = { installed: false, enabled: false }
      const runtime = useWidgetRuntime()
      for (const id of gone) runtime.forget(id)
      void this.persist('卸载')
      void this.persistKinds('卸载')
    },

    /** 停用/启用：只决定桌面渲不渲染，实例与配置都留着 */
    setEnabled(kindId: string, enabled: boolean) {
      this.kinds[kindId] = { ...(this.kinds[kindId] ?? KIND_DEFAULT), enabled }
      void this.persistKinds(enabled ? '启用' : '停用')
    },

    /** 首次运行的默认桌面：只认 manifest.seed，铺放顺序即注册顺序（order） */
    seedDefaults() {
      const registry = useWidgetRegistry()
      const base = Date.now()
      registry.widgets
        .filter((manifest) => manifest.seed)
        .forEach((manifest, index) => {
          const spec = manifest.widget
          this.items.push({
            id: uniqueId(manifest.id, (id) => this.items.some((i) => i.id === id)),
            kindId: manifest.id,
            size: spec.defaultSize ?? spec.sizes[0],
            pos: null,
            config: sanitizeConfig(undefined, manifest),
            addedAt: base + index,
          })
        })
      if (this.items.length) void this.persist('初始化')
    },

    /** 配置类高频写入走这里：300ms 合并，同时解掉「每个击键一次 IDB 写」（E6） */
    persistDebounced(op: string) {
      const pending = this.persistTimers[op]
      if (pending) clearTimeout(pending)
      this.persistTimers[op] = setTimeout(() => {
        delete this.persistTimers[op]
        void this.persist(op)
      }, CONFIG_PERSIST_DEBOUNCE)
    },

    async persist(op: string) {
      await persistBoundary('widgets', `${op}持久化失败`, () =>
        idbSet(WIDGETS_KEY, snapshot(this.items)),
      )
    },

    async persistKinds(op: string) {
      await persistBoundary('widgets', `安装态${op}持久化失败`, () =>
        idbSet(KINDS_KEY, snapshot(this.kinds)),
      )
    },

    /** 还原：实例与 kind 生命周期各占一个键，并行读；kind 由构建期 glob 同步注册，早于本方法 */
    async restore() {
      await Promise.all([this.restoreInstances(), this.restoreKinds()])
    },

    /** 只还原实例；kind 由构建期 glob 同步注册，早于本方法的调用 */
    async restoreInstances() {
      await persistBoundary('widgets', '恢复失败', async () => {
        const saved = await idbGet<unknown>(WIDGETS_KEY)
        // 首次运行（从没写过）按 manifest.seed 铺一批默认件，保住既有桌面的观感；
        // 用户清空过则落库为 []，不再是 undefined，不会把删掉的件又补回来。
        if (saved === undefined || saved === null) {
          this.seedDefaults()
          return
        }
        if (!Array.isArray(saved)) return
        const registry = useWidgetRegistry()
        const clean: WidgetInstance[] = []
        for (const raw of saved) {
          if (!raw || typeof raw !== 'object') continue
          const r = raw as Record<string, unknown>
          if (typeof r.id !== 'string' || typeof r.kindId !== 'string') continue
          // IDB 可被手改：kind 已注销的实例丢弃（与 wm.restoreLayout 丢未知 appId 同口径）
          const manifest = registry.byId(r.kindId)
          if (!manifest) continue
          const spec = manifest.widget
          const size = spec.sizes.includes(r.size as WidgetSize)
            ? (r.size as WidgetSize)
            : (spec.defaultSize ?? spec.sizes[0])
          clean.push({
            id: r.id,
            kindId: r.kindId,
            size,
            pos: validCell(r.pos),
            config: sanitizeConfig(r.config, manifest),
            addedAt: Number(r.addedAt) || 0,
          })
        }
        this.items = clean
      })
    },

    /** kind 生命周期：与实例同一口径丢弃手改数据（kind 已注销、条目非对象） */
    async restoreKinds() {
      await persistBoundary('widgets', '小组件安装态恢复失败', async () => {
        const saved = await idbGet<unknown>(KINDS_KEY)
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return
        const registry = useWidgetRegistry()
        const clean: Record<string, WidgetKindState> = {}
        for (const [kindId, raw] of Object.entries(saved)) {
          if (!registry.byId(kindId)) continue
          if (!raw || typeof raw !== 'object') continue
          const r = raw as Record<string, unknown>
          clean[kindId] = { installed: r.installed !== false, enabled: r.enabled !== false }
        }
        this.kinds = clean
      })
    },
  },
})
