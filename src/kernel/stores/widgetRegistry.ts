import { defineAsyncComponent, markRaw, type Component } from 'vue'
import { defineStore } from 'pinia'
import type { IconName } from '../icons'
import { useSession } from './session'

type WidgetEntry = () => Promise<Component>

/** 尺寸档：跨列跨行数由 kernel/widget/geometry.ts 的 SIZE_SPAN 决定 */
export type WidgetSize = 'sm' | 'md' | 'lg'

export type WidgetConfigType = 'text' | 'number' | 'boolean' | 'select'

/**
 * select 候选：裸字符串只用于「值即可读文本」的极少数场合（如 UTC 偏移）；
 * 双语界面下的可读标签必须走 `labelKey`，否则要么显示英文原值、要么把中文塞进代码，
 * 并且绕过语言包齐平门禁。
 */
export type WidgetConfigOption =
  string | { value: string; labelKey?: string; label?: string; icon?: IconName }

/** 声明式配置项：只描述键与取值域，控件由宿主渲染，widget 只在必要时用 configEntry 自绘表达 */
export interface WidgetConfigField {
  key: string
  type: WidgetConfigType
  /** i18n 文案 key，回退 label */
  labelKey?: string
  label?: string
  default?: string | number | boolean
  /** type === 'select' 时的候选值 */
  options?: WidgetConfigOption[]
  min?: number
  max?: number
  step?: number
  placeholderKey?: string
  placeholder?: string
}

/** 刷新节奏档：宿主据此决定调度周期、右键菜单是否给「立即刷新」 */
export type WidgetRefresh = 'live' | 'minute' | 'hour' | 'day' | 'manual'

/** 卡片外边距两档（HIG：标准 16、需要分组时 11，Mac 桌面用较小外边距） */
export type WidgetPadding = 'default' | 'compact'

/** 下钻时可携带的上下文：件把「卡片上那条内容」告诉应用（U7） */
export interface WidgetDrillContext {
  size: WidgetSize
  config: Record<string, string | number | boolean>
  /** 件内当前选中项（月历给日期、待办给筛选），由组件经 useWidgetContext().setSelected 写入 */
  selected?: unknown
}

/** 下钻目标：裸 appId 只落应用首页，按 HIG 判为半吊子下钻——内置件一律给 payloadFor */
export type WidgetOpenTarget =
  string | { appId: string; payloadFor?: (ctx: WidgetDrillContext) => unknown }

export interface WidgetSpec {
  /** 支持的尺寸档（至少一项）；卡片菜单档位组、管理面分段控件与 ⌥←/⌥→ 都只在这些档里取（S-1：不产生任意 span） */
  sizes: WidgetSize[]
  /** 初始尺寸档；缺省取 sizes[0] */
  defaultSize?: WidgetSize
}

/**
 * 桌面小组件契约。与 AppManifest 的差异是刻意的：小组件不进窗口体系、不进 Dock、
 * 不进应用中心类目，因此没有 window/dock/category 这些字段，新增的是尺寸档、
 * 每实例配置 schema、数据声明、刷新节奏与「下钻到具体内容」的声明。
 */
export interface WidgetManifest {
  id: string
  name: string
  /** i18n 文案 key，回退 name */
  nameKey?: string
  /** 目录行一句话描述（B5）。写法受 HIG 约束：动词开头、禁自指（门禁 T9） */
  descriptionKey?: string
  description?: string
  icon: IconName
  /** 小组件库磁贴渐变类（同 AppManifest.tint），取深档保证白线图标对比度达标；
   * 目录行「添加」按钮与高亮同样消费它（HIG：可为添加按钮着色） */
  tint?: string
  entry: WidgetEntry
  widget: WidgetSpec
  /** 卡片内边距档；缺省 default=16，compact=11 给 sm 换回内容面积（决策 8） */
  padding?: WidgetPadding
  /** 声明了 refresh 的件，宿主给「立即刷新」菜单项并暴露 lastRefreshAt（A-9/A-10） */
  refresh?: WidgetRefresh
  /** 自有数据声明：供预览沙箱喂样例、供「孤儿数据」段盘点（B1） */
  data?: WidgetDataSpec
  /** true = 桌面最多一个实例（重复添加复用既有实例）；缺省 false = 多实例（对齐 macOS） */
  singleton?: boolean
  /** 小组件中心搜索框消费它（keywords + name + description） */
  keywords?: string[]
  version?: string
  /** 访问所需权限点集合；为空表示公开 */
  permissions?: string[]
  /** 小组件库排序权重，越小越靠前；缺省 100 */
  order?: number
  /** 每实例配置 schema；缺省表示该小组件无配置面。声明 configEntry 时它仍是写边界 */
  config?: WidgetConfigField[]
  /** 件自绘配置面板（§4.12）：只换表达，schema 恒必填、提交仍过 sanitizeConfig */
  configEntry?: () => Promise<Component>
  /** 首次运行（从未落库过实例）时是否默认铺到桌面；用户清空后不再补种 */
  seed?: boolean
  /** 下钻落点：展示型整块可点；交互型/混合型由件把标题行做成入口（§4.5） */
  openAppId?: WidgetOpenTarget
  /**
   * §4.5 三类件的判别位：true = 卡内自持交互（待办、便签、快捷设置），
   * 平台**不接管**整块点击——下钻只走卡片菜单、Enter 键与件自己做的标题行入口。
   * 缺省 false = 展示型（`openAppId` 生效即整块可点）。
   */
  interactive?: boolean
}

export interface WidgetDataSpec {
  /** 共享数据键：/我的数据/<key>.json；scope=instance 时为 /我的数据/<kindId>/<instanceId>.json */
  key: string
  scope: 'shared' | 'instance'
}

export type RegisteredWidget = WidgetManifest & { component: Component }

const DEFAULT_ORDER = 100

function orderOf(w: { order?: number }): number {
  return w.order ?? DEFAULT_ORDER
}

/** select 候选归一：把裸字符串与对象两种写法折成同一形状，宿主只管渲染这一形状 */
export interface NormalizedOption {
  value: string
  labelKey?: string
  label?: string
  icon?: IconName
}

export function normalizeOptions(field: WidgetConfigField): NormalizedOption[] {
  return (field.options ?? []).map((o) =>
    typeof o === 'string' ? { value: o, label: o } : { ...o },
  )
}

/** 下钻目标归一：解出 appId 与「带 payload」的构造器 */
export function resolveOpenTarget(
  target: WidgetOpenTarget | undefined,
  ctx: WidgetDrillContext,
): { appId: string; payload?: unknown } | null {
  if (!target) return null
  if (typeof target === 'string') return { appId: target }
  return { appId: target.appId, payload: target.payloadFor?.(ctx) }
}

export const useWidgetRegistry = defineStore('widgetRegistry', {
  state: () => ({
    widgets: [] as RegisteredWidget[],
  }),
  getters: {
    /** 当前会话可访问的小组件（已按 order 排序）；派生入口一律消费此 getter */
    accessibleWidgets(state): RegisteredWidget[] {
      const session = useSession()
      return state.widgets.filter((w) => session.canAccess(w))
    },
    /** 无权限的 kind：目录要给灰态行「需要 <角色>」，而不是让它从货架上静默消失（HIG H-10） */
    inaccessibleWidgets(state): RegisteredWidget[] {
      const session = useSession()
      return state.widgets.filter((w) => !session.canAccess(w))
    },
    byId: (state) => (id: string) => state.widgets.find((w) => w.id === id),
  },
  actions: {
    register(manifest: WidgetManifest) {
      if (this.widgets.some((w) => w.id === manifest.id)) return
      const widget: RegisteredWidget = {
        ...manifest,
        component: markRaw(defineAsyncComponent(manifest.entry)),
      }
      // 按 order 升序稳定插入（同权重保持先注册在前），画廊排序不依赖 glob 收集顺序
      const at = this.widgets.findIndex((w) => orderOf(w) > orderOf(widget))
      if (at === -1) this.widgets.push(widget)
      else this.widgets.splice(at, 0, widget)
    },

    unregister(id: string) {
      const at = this.widgets.findIndex((w) => w.id === id)
      if (at !== -1) this.widgets.splice(at, 1)
    },
  },
})
