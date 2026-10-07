import type { InjectionKey, ComputedRef } from 'vue'
import type { Rect } from '../layout'
import type { CellRect, WidgetCell, WidgetGrid } from './geometry'
import type { WidgetSize } from '../stores/widgetRegistry'

/** 手势中的落点预览（S-4/L-2）：吸附后的整格位，桌面对坐标、不含指针位移 */
export interface WidgetPreviewState {
  id: string
  rect: Rect
  valid: boolean
}

/**
 * 宿主（WidgetLayer）给卡片的事实：网格、格位与占用判定。
 * 卡片因此不必自己算视口、也不认识邻居——几何权威只在层里写一次（§4.1 内聚判据）。
 */
export interface WidgetHostLayout {
  grid: ComputedRef<WidgetGrid>
  /** 某实例当前占的格位（自动流式与手动态都给） */
  cellOf(id: string): CellRect | null
  /** 除自己以外被占用的格位（L-8：换档与拖拽共用同一个占用判定） */
  takenExcept(id: string): CellRect[]
  /** 该格位 + 该档是否放得下（越界与重叠都在这里判，件侧不接触规则） */
  canPlaceFor(id: string, size: WidgetSize, cell: WidgetCell): boolean
  /** 首次手动拖拽的一次性迁移（台账 C-④）：把全部流式实例的当前格位固化成 {col,row} */
  pinAutoPositions(): void
  /**
   * 手势期间把「会落在哪」交给层来画（S-4/L-2）。**不能画在卡片自己身上**：
   * 卡片带跟手的 `transform` 且材质是 `overflow-hidden`，画在里面的预览框会被指针位移带走、
   * 越出卡片本体还会被裁掉——落点等于当前格时它与卡片完全重合，等于没有反馈。
   * 传 null 清空（落定、被拒、pointercancel 三条路都要清）。
   */
  setPreview(preview: WidgetPreviewState | null): void
}

export const WIDGET_HOST_KEY: InjectionKey<WidgetHostLayout> = Symbol('widgetHostLayout')
