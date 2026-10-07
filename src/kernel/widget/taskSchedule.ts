/**
 * 「今日」这一域的数据契约：待办件（`src/widgets/todos`）与「今日」应用共享同一份文件，
 * 但两边**互不 import 组件**，只共享这里的类型与规整函数（台账 C-③：用数据契约替代组件耦合）。
 * 文件落在 VFS `/我的数据/tasks.json` 与 `/我的数据/events.json`，删除小组件不会删除它们。
 */

export const TASKS_KEY = 'tasks'
export const EVENTS_KEY = 'events'

/** ISO 日期 `YYYY-MM-DD`，与月历的选中日、待办的 due 用同一种写法 */
export type IsoDay = string

export interface Task {
  id: string
  title: string
  done: boolean
  /** 计划日；缺省 = 不排在任何具体一天（只出现在「全部」里） */
  due?: IsoDay
  createdAt: number
  /**
   * 仅预览沙箱使用（§4.8 屏蔽 1）：件自带的样例数据要有双语可读名，
   * 真数据里出现它也不生效——内容层只在 `preview` 为真时按它取文案。
   */
  titleKey?: string
}

export interface ScheduleEvent {
  id: string
  title: string
  date: IsoDay
  /** 起始时刻 `HH:mm`，缺省 = 全天事项 */
  start?: string
  durationMin?: number
  /** 同 [[Task]] 的 titleKey：只服务预览样例 */
  titleKey?: string
}

export interface TaskFile {
  version: 1
  tasks: Task[]
}

export interface EventFile {
  version: 1
  events: ScheduleEvent[]
}

export function emptyTasks(): TaskFile {
  return { version: 1, tasks: [] }
}

export function emptyEvents(): EventFile {
  return { version: 1, events: [] }
}

export function toIsoDay(d: Date): IsoDay {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined
}

/**
 * 读入即规整：VFS 内容可被用户手工编辑，脏条目一律丢掉而不是把 undefined 画到界面上
 * （§4.9 批次 B 的「降级即整项不渲染」同一条口径）。
 */
export function normalizeTasks(raw: unknown): TaskFile {
  const list = (raw as Partial<TaskFile> | null)?.tasks
  if (!Array.isArray(list)) return emptyTasks()
  const tasks: Task[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const r = item as unknown as Record<string, unknown>
    const title = str(r.title)
    if (!title) continue
    tasks.push({
      id: typeof r.id === 'string' ? r.id : `t-${tasks.length}`,
      title,
      done: r.done === true,
      due: str(r.due) as IsoDay | undefined,
      createdAt: Number(r.createdAt) || 0,
      titleKey: str(r.titleKey),
    })
  }
  return { version: 1, tasks }
}

export function normalizeEvents(raw: unknown): EventFile {
  const list = (raw as Partial<EventFile> | null)?.events
  if (!Array.isArray(list)) return emptyEvents()
  const events: ScheduleEvent[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const r = item as unknown as Record<string, unknown>
    const title = str(r.title)
    const date = str(r.date)
    if (!title || !date) continue
    events.push({
      id: typeof r.id === 'string' ? r.id : `e-${events.length}`,
      title,
      date,
      start: str(r.start),
      durationMin: Number.isFinite(Number(r.durationMin)) ? Number(r.durationMin) : undefined,
      titleKey: str(r.titleKey),
    })
  }
  return { version: 1, events }
}

/**
 * 预览样例的可读名解析：只有沙箱内认 `titleKey`，真数据里同名字段一律不生效——
 * 否则用户手工编辑的文件就能把界面文案换成任意 key。
 */
export function displayTitle(
  item: { title: string; titleKey?: string },
  ctx: { preview: boolean; label: (key: string) => string | undefined },
): string {
  if (!ctx.preview || !item.titleKey) return item.title
  return ctx.label(item.titleKey) ?? item.title
}

/** 新增条目用的本地 id：纯前端没有服务端主键，时间戳 + 序号足够 */
export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** 未完成优先、再按到期日、最后按创建时间——待办件与「今日」应用共用同一套排序 */
export function sortTasks(tasks: Task[]): Task[] {
  return tasks.slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    const ad = a.due ?? '9999-12-31'
    const bd = b.due ?? '9999-12-31'
    if (ad !== bd) return ad < bd ? -1 : 1
    return a.createdAt - b.createdAt
  })
}

/**
 * 预览沙箱专用样例（§4.8 屏蔽 1：样例由件自带）。
 * 日期一律锚在**今天**——「今天」筛选会把静态样例全滤掉，预览就变成空态。
 * 可读名走 `titleKey`（双语），`title` 是 key 缺失时的兜底。
 */
export function sampleTasks(): TaskFile {
  const today = toIsoDay(new Date())
  return {
    version: 1,
    tasks: [
      {
        id: 's1',
        title: '整理园区巡检记录',
        titleKey: 'widgets.sample.task1',
        done: false,
        due: today,
        createdAt: 1,
      },
      {
        id: 's2',
        title: '与设计约方案评审',
        titleKey: 'widgets.sample.task2',
        done: false,
        due: today,
        createdAt: 2,
      },
      {
        id: 's3',
        title: '回复合同附件',
        titleKey: 'widgets.sample.task3',
        done: false,
        due: today,
        createdAt: 3,
      },
      {
        id: 's4',
        title: '更新周报数据',
        titleKey: 'widgets.sample.task4',
        done: true,
        due: today,
        createdAt: 4,
      },
    ],
  }
}

export function sampleEvents(): EventFile {
  const today = toIsoDay(new Date())
  return {
    version: 1,
    events: [
      {
        id: 'e1',
        title: '产品方案评审',
        titleKey: 'widgets.sample.event1',
        date: today,
        start: '09:30',
      },
      {
        id: 'e2',
        title: '客户巡场',
        titleKey: 'widgets.sample.event2',
        date: today,
        start: '14:00',
      },
      {
        id: 'e3',
        title: '周会同步',
        titleKey: 'widgets.sample.event3',
        date: today,
        start: '16:30',
      },
      {
        id: 'e4',
        title: '实施组例会',
        titleKey: 'widgets.sample.event4',
        date: today,
        start: '18:00',
      },
    ],
  }
}
