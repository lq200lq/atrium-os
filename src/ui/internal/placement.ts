import type { Placement } from '../types'

/**
 * 浮层定位原语（S10）：四边 × 三对齐 = 12 方位。
 * 类串全部是**静态字面量**——Tailwind 4 靠源码扫描生成工具类，运行时拼接出的
 * 类不存在于产物；偏移只取间距刻度（2xs = 4px 一档），不写裸 px。
 *
 * 明确不做 viewport 溢出翻转：翻转需要测量触发元素/视口/浮层三方尺寸，属定位
 * 引擎而非类名映射的职责。该取舍留在 S11（全局配置层）之后，随富内容浮层
 * （OsPopover/OsDropdown，见规划文档 §8「Popover」行的翻案条件）一并评估。
 */
const PLACEMENT_CLASS: Record<Placement, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2xs',
  'top-start': 'bottom-full left-0 mb-2xs',
  'top-end': 'bottom-full right-0 mb-2xs',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2xs',
  'bottom-start': 'top-full left-0 mt-2xs',
  'bottom-end': 'top-full right-0 mt-2xs',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2xs',
  'left-start': 'right-full top-0 mr-2xs',
  'left-end': 'right-full bottom-0 mr-2xs',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2xs',
  'right-start': 'left-full top-0 ml-2xs',
  'right-end': 'left-full bottom-0 ml-2xs',
}

/** placement → 静态 Tailwind 类串（值必须是源码里的字面量，否则扫描不到） */
export const placementClass = (placement: Placement): string => PLACEMENT_CLASS[placement]
