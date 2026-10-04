import type { DataSource } from './types'

/**
 * 远端数据源占位：接后端时新增一个实现 DataSource<T> 的 HTTP 适配器即可，应用侧无需改动。
 * 沿用架构非目标——当前只留接口不实现，不起 mock server。
 */
export interface RemoteDataSource<T> extends DataSource<T> {
  /** 远端基址，便于多环境切换；本地实现无需此字段 */
  readonly baseUrl: string
}
