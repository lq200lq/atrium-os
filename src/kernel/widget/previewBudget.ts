/**
 * 预览渲染的全局并发预算（§4.8）：管理面一屏能列出十几行目录，每行都是**真实组件树**，
 * 同时全挂就是把首屏付给十几次数据读取与渲染。只有「在视口内且抢到槽」的行才挂载，
 * 滑出视口即还槽——所以这个上限是稳态上限，不是「前 4 个永远占位」。
 */
const MAX_LIVE = 4

interface Waiter {
  inView: () => boolean
  grant: (live: boolean) => void
}

let liveCount = 0
const waiters: Waiter[] = []

function schedule(): void {
  while (liveCount < MAX_LIVE) {
    const at = waiters.findIndex((w) => w.inView())
    if (at < 0) return
    const [next] = waiters.splice(at, 1)
    liveCount++
    next?.grant(true)
  }
}

/** 申请一个预览槽；返回的函数撤销排队或归还已获得的槽，可重复调用 */
export function requestPreviewSlot(
  inView: () => boolean,
  grant: (live: boolean) => void,
): () => void {
  const waiter: Waiter = { inView, grant }
  waiters.push(waiter)
  schedule()

  let done = false
  return () => {
    if (done) return
    done = true
    const at = waiters.indexOf(waiter)
    if (at >= 0) {
      waiters.splice(at, 1)
      return
    }
    liveCount--
    grant(false)
    schedule()
  }
}

/** 视口状态变了（滚动 / 抽屉展开）时重算：排队中的行可能此刻才可见 */
export function retryPreviewSlots(): void {
  schedule()
}

/** 当前占用数与等待数，供测试断言并发上限（§9 T8） */
export function previewSlotState(): { live: number; queued: number } {
  return { live: liveCount, queued: waiters.length }
}
