/**
 * 持久化边界外壳：写/读共用同一条降级路径——失败只 `console.warn` 不抛，
 * 界面照常、数据不落库（或不还原）。
 *
 * 调用方把「读写 + 校验」**整段**包进 task，语义与各自原来的 try/catch 逐字等价
 * （校验抛错同样落 warn，不会漏到调用方）；scope 与 label 沿用各 store 既有日志文案，
 * 日志检索口径不断档。取值边界仍是 kernel/fs/idb，本文件不碰 IDB 细节。
 */
export async function persistBoundary<T>(
  scope: string,
  label: string,
  task: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await task()
  } catch (e) {
    console.warn(`[${scope}] ${label}`, e)
    return undefined
  }
}
