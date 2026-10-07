import { ref } from 'vue'
import { type FsNode } from '../fs/types'
import type { WidgetDataSpec } from '../stores/widgetRegistry'

/** 小组件自有数据的根：VFS 是唯一业务后端，因此数据在文件管理里可见、可被别的应用消费（§4.2） */
export const DATA_ROOT = '/我的数据'

export const JSON_MIME = 'application/json'

/**
 * 防抖窗口内的待落盘值，**按 VFS 路径共享**（§4.2 写边界）。
 * 这本账挂在寻址权威所在处、而不是某个 composable 里：同一份 `shared` 文件的写者不止小组件卡片
 * （「今日」应用直接写 `tasks.json`），件内与件外必须看见同一份挂起值——否则后写的那一方会以
 * 「读不到前一次」的旧底为基，把前一次整条吃掉（功能设计 §8 偏差 16）。
 */
const pendingWrites = ref(new Map<string, string>())

/** 写之前挂账（件侧：等防抖窗口关掉再落 VFS） */
export function holdWidgetData(path: string, json: string) {
  pendingWrites.value.set(path, json)
}

/**
 * 落进 VFS 后销账。传 `json` 时只在挂起的仍是这一份时才销（窗口内另有写者改过就留着它），
 * 不传表示「VFS 现在就是最新真相」（件外写者同步写完即销）。
 */
export function releaseWidgetData(path: string, json?: string) {
  if (json !== undefined && pendingWrites.value.get(path) !== json) return
  pendingWrites.value.delete(path)
}

/** 窗口内挂着的那一份（没挂账就是 `undefined`）：件侧 flush 只认这个，不认 VFS */
export function peekWidgetData(path: string): string | undefined {
  return pendingWrites.value.get(path)
}

/** 这份数据的「当前真相」：挂起值优先于 VFS 内容。件与件外写者走同一条读边，读不到才会互相覆盖 */
export function readWidgetDataJson(
  vfs: { byPath(path: string): FsNode | undefined },
  path: string,
): string | undefined {
  return pendingWrites.value.get(path) ?? vfs.byPath(path)?.content
}

/**
 * 寻址只此一处（台账 C-②）：件不得自己拼路径。
 * shared → `/我的数据/<key>.json`（跨件跨应用共享，如 tasks.json）
 * instance → `/我的数据/<kindId>/<instanceId>.json`（该实例私有，多实例各写各的）
 */
export function widgetDataPath(
  spec: WidgetDataSpec,
  ctx: { kindId: string; instanceId: string },
): string {
  if (spec.scope === 'instance') return `${DATA_ROOT}/${ctx.kindId}/${ctx.instanceId}.json`
  return `${DATA_ROOT}/${spec.key}.json`
}

/** 该 JSON 节点是否属于小组件数据区（孤儿盘点只看这一带） */
export function isWidgetDataNode(node: FsNode): boolean {
  return (
    node.type === 'file' && node.path.startsWith(`${DATA_ROOT}/`) && node.path.endsWith('.json')
  )
}

/**
 * 孤儿数据：`/我的数据/` 下已无任何**在册实例**引用的 JSON（§4.2 规则 5，删件不删数据 ⇒ 需要出口）。
 * 引用集 = 各实例 kind 的 `manifest.data` 经 widgetDataPath 解出的路径。
 */
export function orphanDataPaths(nodes: FsNode[], referenced: Set<string>): FsNode[] {
  return nodes
    .filter((n) => isWidgetDataNode(n) && !referenced.has(n.path))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}
