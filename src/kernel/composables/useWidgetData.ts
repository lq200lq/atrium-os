import { computed, inject, onScopeDispose, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVfs } from '../stores/vfs'
import { useNotification } from '../stores/notification'
import { snapshot } from '../stores/widgets'
import { useWidgetContext, WIDGET_PREVIEW_KEY } from './useWidgetContext'
import {
  widgetDataPath,
  JSON_MIME,
  DATA_ROOT,
  holdWidgetData,
  releaseWidgetData,
  peekWidgetData,
  readWidgetDataJson,
} from '../widget/widgetData'
import { parentOf, baseName } from '../fs/types'

/** 与界面 chrome 分开：数据读写失败走通知中心集中上报（S3/S4 口径），不在件内弹错误框 */
const DATA_WRITE_DEBOUNCE = 300

export type WidgetDataStatus = 'idle' | 'pending' | 'error'

export interface WidgetDataHandle<T> {
  data: ComputedRef<T>
  write(next: T): void
  patch(partial: Partial<T>): void
  status: Ref<WidgetDataStatus>
  retry(): void
}

/** 逐级补齐父目录（VFS 的 mkdir 会去重，因此必须先判存在） */
function ensureDirs(vfs: ReturnType<typeof useVfs>, path: string) {
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

/**
 * 小组件自有数据的唯一正道（§4.2）：寻址由宿主按 context 解出，件不拼路径。
 * 乐观更新 + 失败回滚 + 通知上报，300ms 合并写，首次读落 factory 默认值。
 * 预览沙箱内（inject 到 WIDGET_PREVIEW_KEY）返回件自带样例、写为 no-op、不碰真实 VFS。
 */
export function useWidgetData<T>(key?: string, factory?: () => T): WidgetDataHandle<T> {
  const { instanceId, kindId, manifest } = useWidgetContext()
  const previewCtx = inject(WIDGET_PREVIEW_KEY, null)
  const { t } = useI18n()

  const dataKey = key ?? manifest.value?.data?.key ?? kindId.value
  const scope = manifest.value?.data?.scope ?? 'shared'
  const path = widgetDataPath({ key: dataKey, scope }, { kindId: kindId.value, instanceId })
  const fallback = factory ?? (() => undefined as unknown as T)

  if (previewCtx) {
    const sample = (previewCtx.sample?.[dataKey] ?? fallback()) as T
    const blocked = () => {
      if (import.meta.env.DEV) {
        console.assert(false, `[widgets] 预览沙箱内不得写真实数据（${path}）`)
      }
    }
    return {
      data: computed(() => sample),
      write: blocked,
      patch: blocked,
      status: ref('idle'),
      retry: blocked,
    }
  }

  const vfs = useVfs()
  const notification = useNotification()
  const status = ref<WidgetDataStatus>('idle')
  /** 落库失败时要回滚到的内容：本 handle 这一次写之前的样子 */
  let lastGood: string | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const parsed = computed<T>(() => {
    // 挂账优先（本 handle 与其他 handle、包括件外写者的写都算），否则读 VFS
    const raw = readWidgetDataJson(vfs, path)
    if (raw === undefined || raw === null || raw === '') return fallback()
    try {
      return JSON.parse(raw) as T
    } catch {
      // IDB/文件可被手改：坏 JSON 当未初始化处理，不让整张卡炸掉
      return fallback()
    }
  })

  async function flush() {
    const json = peekWidgetData(path)
    if (json === undefined) return
    status.value = 'pending'
    if (!vfs.ready) {
      // VFS 还在还原：保住挂账，等它就绪由 watch 补落盘
      return
    }
    lastGood = vfs.byPath(path)?.content ?? null
    ensureDirs(vfs, path)
    if (vfs.byPath(path)) vfs.updateContent(path, json)
    else vfs.writeFile(parentOf(path), baseName(path), json, JSON_MIME)
    // 乐观更新即 VFS 内容：这一份真落进去了就销账，读侧从此走 byPath
    releaseWidgetData(path, json)
    const ok = await vfs.persist()
    if (ok) {
      status.value = 'idle'
      return
    }
    // 落库失败：回滚到写入前的内容，并上报——件不该自己弹错误框
    if (vfs.byPath(path)) {
      if (lastGood === null) vfs.remove(path)
      else vfs.updateContent(path, lastGood)
    }
    status.value = 'error'
    notification.push(
      t('widgets.dataErrorTitle', { name: manifest.value?.name ?? kindId.value }),
      t('widgets.dataErrorBody'),
    )
  }

  function schedule() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, DATA_WRITE_DEBOUNCE)
  }

  function write(next: T) {
    holdWidgetData(path, JSON.stringify(snapshot(next)))
    schedule()
  }

  function patch(partial: Partial<T>) {
    const base = parsed.value as object
    write({ ...(base ?? {}), ...partial } as T)
  }

  function retry() {
    if (timer) clearTimeout(timer)
    void flush()
  }

  // VFS 晚于件挂载（首屏并发还原）：就绪后把挂起的写补上，并给未初始化的文件落默认值
  watch(
    () => vfs.ready,
    (ready) => {
      if (!ready) return
      if (peekWidgetData(path) !== undefined) void flush()
      else if (!vfs.byPath(path)) write(parsed.value)
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    if (timer) clearTimeout(timer)
    if (peekWidgetData(path) !== undefined) void flush()
  })

  return { data: parsed, write, patch, status, retry }
}

/** 供「孤儿数据」段与预览沙箱复用：把某 kind 的引用路径解出来（不渲染组件也能算） */
export function referencedDataPaths(
  instances: { id: string; kindId: string }[],
  dataOf: (kindId: string) => { key: string; scope: 'shared' | 'instance' } | undefined,
): Set<string> {
  const out = new Set<string>([DATA_ROOT])
  for (const instance of instances) {
    const spec = dataOf(instance.kindId)
    if (!spec) continue
    out.add(widgetDataPath(spec, { kindId: instance.kindId, instanceId: instance.id }))
  }
  return out
}
