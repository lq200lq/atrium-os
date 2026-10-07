import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, type Component } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createWidgetContext, provideWidgetContext } from '@/kernel/composables/useWidgetContext'
import { useWidgetData, type WidgetDataHandle } from '@/kernel/composables/useWidgetData'
import { useWidgetRegistry, type WidgetManifest } from '@/kernel/stores/widgetRegistry'
import { useVfs } from '@/kernel/stores/vfs'
import { useWidgets } from '@/kernel/stores/widgets'
import { baseName } from '@/kernel/fs/types'
import {
  DATA_ROOT,
  JSON_MIME,
  readWidgetDataJson,
  releaseWidgetData,
} from '@/kernel/widget/widgetData'

/**
 * §4.2 写边界的防抖窗口：`DATA_WRITE_DEBOUNCE`（300ms）内的连续写必须**逐条累计**，
 * 而不是各以「读得到的旧底」为基互相覆盖。
 *
 * 这条是被 e2e 的 T1 腿撞出来的真实缺陷（`tests/e2e/widget-persistence.spec.ts` 里那条
 * 「300ms 内连按两次 Enter」）：pending 原先挂在每个 handle 自己身上，而写时的基线读的是
 * VFS 内容——防抖窗口里 VFS 还没更新，于是第二次写把第一次整条吃掉。
 * 同一份 shared 数据本就允许多个写者（`todos` 的 md/lg 两张卡、「今日」应用写同一个文件），
 * 所以修法是把 pending 按 **VFS 路径**共享，而不是给某个 handle 打补丁。
 */

const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))

vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value)
  }),
}))

interface Doc {
  items: string[]
}

const PATH = `${DATA_ROOT}/tasks.json`

/** 件侧探针：handle 交给测试，断言打在它的 data 与 VFS 内容上 */
const sinks: WidgetDataHandle<Doc>[] = []
const Consumer: Component = defineComponent({
  name: 'Consumer',
  setup() {
    const handle = useWidgetData<Doc>('tasks', () => ({ items: [] }))
    sinks.push(handle)
    return () => h('p', handle.data.value.items.join(','))
  },
})

function manifest(): WidgetManifest {
  return {
    id: 'merge-test',
    name: '合并测试件',
    icon: 'sparkles',
    entry: () => Promise.resolve({ name: 'Stub', render: () => h('p', 'x') } as never),
    widget: { sizes: ['md'] },
    data: { key: 'tasks', scope: 'shared' },
  }
}

function mountHandle(): WidgetDataHandle<Doc> {
  const added = useWidgets().add('merge-test', 'md')
  if (!added.ok) throw new Error('前置失败：实例未建立')
  const Host: Component = defineComponent({
    name: 'Host',
    setup() {
      provideWidgetContext(createWidgetContext(added.instance.id))
      return () => h(Consumer)
    },
  })
  const wrapper = mount(Host)
  wrappers.push(wrapper)
  const handle = sinks[sinks.length - 1]
  if (!handle) throw new Error('前置失败：件侧探针未挂载')
  return handle
}

const wrappers: VueWrapper[] = []

/** 文件内容（去 JSON 壳）：断言打真实 VFS 状态，不看 handle 自己的乐观值 */
const fileItems = () => {
  const raw = useVfs().byPath(PATH)?.content
  return raw ? ((JSON.parse(raw) as Doc).items ?? []) : null
}

describe('useWidgetData 防抖窗口内的写合并（§4.2）', () => {
  beforeEach(async () => {
    idbStore.clear()
    setActivePinia(createPinia())
    useWidgetRegistry().register(manifest())
    // 目录由 flush 里的 ensureDirs 逐级补齐（§4.2 的写路径自带），这里只把 VFS 标成就绪
    useVfs().ready = true
    await flushPromises()
    await nextTick()
  })

  afterEach(() => {
    for (const wrapper of wrappers.splice(0)) wrapper.unmount()
    sinks.splice(0)
    vi.useRealTimers()
  })

  it('同一 handle 在防抖窗口内连写两次：两条都在（第二次不以旧底为基）', async () => {
    vi.useFakeTimers()
    const handle = mountHandle()
    await flushPromises()

    const push = (item: string) => handle.write({ items: [...handle.data.value.items, item] })
    push('第一条')
    push('第二条')
    expect(handle.data.value.items, '乐观读必须立刻看见两次写').toEqual(['第一条', '第二条'])

    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(fileItems()).toEqual(['第一条', '第二条'])
  })

  it('两个写者共享同一份 shared 数据：各推一条，两条都在', async () => {
    vi.useFakeTimers()
    const a = mountHandle()
    const b = mountHandle()
    await flushPromises()

    a.write({ items: [...a.data.value.items, 'A 卡的'] })
    b.write({ items: [...b.data.value.items, 'B 卡的'] })

    // 跨 handle 的乐观可见性：另一张卡也立刻读到合并后的样子
    expect(a.data.value.items).toEqual(['A 卡的', 'B 卡的'])
    expect(b.data.value.items).toEqual(['A 卡的', 'B 卡的'])

    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(fileItems()).toEqual(['A 卡的', 'B 卡的'])
  })

  it('落库失败：这一次写之前没有文件就把文件撤掉，并置 error 上报', async () => {
    vi.useFakeTimers()
    const handle = mountHandle()
    await flushPromises()
    const vfs = useVfs()
    const persist = vi.spyOn(vfs, 'persist').mockImplementation(async () => false)

    handle.write({ items: [...handle.data.value.items, '会丢的一条'] })
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(fileItems(), 'persist 失败要回滚，不留乐观值').toBeNull()
    expect(handle.status.value).toBe('error')
    persist.mockRestore()
  })

  /**
   * 件外写者：「今日」应用直接写同一个 `tasks.json`（§4.2 决策 2 给它做「家」）。
   * 它与卡片 handle 是两个互不相干的调用方，所以这条测的是**同一份挂起账对件外可见**——
   * 应用读要读到卡片窗口里那条，写完要作废挂账，否则卡片下一次 flush 会把应用这条倒回旧底。
   */
  it('件外写者（应用同步写 VFS）与件内防抖写共存：两条都在，且挂账不倒退', async () => {
    vi.useFakeTimers()
    const handle = mountHandle()
    await flushPromises()

    handle.write({ items: [...handle.data.value.items, '卡里的'] })
    appWrite('应用里的')
    await flushPromises()

    expect(fileItems(), '应用那次同步落 VFS，读得到合并后的两条').toEqual(['卡里的', '应用里的'])

    // 卡片的 flush 随后到点：挂账已被应用作废，它不该再写一次旧底
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(fileItems()).toEqual(['卡里的', '应用里的'])
    expect(handle.data.value.items).toEqual(['卡里的', '应用里的'])
  })
})

/** 「今日」应用的写法（`src/apps/today/App.vue` 的 `writeJson`）：读走合并边、写完作废挂账 */
function appWrite(item: string) {
  const vfs = useVfs()
  if (!vfs.byPath(DATA_ROOT)) vfs.mkdir('/', baseName(DATA_ROOT))
  const current = JSON.parse(readWidgetDataJson(vfs, PATH) ?? '{"items":[]}') as Doc
  const json = JSON.stringify({ items: [...current.items, item] } satisfies Doc)
  if (vfs.byPath(PATH)) vfs.updateContent(PATH, json)
  else vfs.writeFile(DATA_ROOT, baseName(PATH), json, JSON_MIME)
  releaseWidgetData(PATH)
}
