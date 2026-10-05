import type { IconName } from '@/kernel/icons'

/** 控件尺寸档位：数值来自 --control-height-* 刻度（24 / 28 / 32） */
export type Size = 'sm' | 'md' | 'lg'

/** 录入类控件的校验状态；非 default 时描边与状态环由语义色刻度派生 */
export type Status = 'default' | 'error' | 'warning'

/** 所有可交互基础组件共享的通用 props 契约 */
export interface CommonProps {
  size?: Size
  disabled?: boolean
  loading?: boolean
}

/** 展示型徽标语义：Status 之外补两类只读语义（成功/进行中） */
export type BadgeStatus = Status | 'success' | 'info'

export interface TableColumn<T> {
  key: keyof T & string
  title: string
  width?: string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  /** 具名插槽名；提供后用该插槽自定义单元格，否则直接渲染 row[key] */
  slot?: string
}

export type SortOrder = 'asc' | 'desc' | null

export type FieldType = 'input' | 'textarea' | 'select' | 'switch' | 'checkbox' | 'radio'

export interface FormField {
  key: string
  label: string
  type: FieldType
  options?: { value: string; label: string }[]
  placeholder?: string
  required?: boolean
  /** number 类型校验数值上下界；string 类型校验长度上下界 */
  min?: number
  max?: number
  pattern?: string
  /** 自定义校验失败文案 */
  message?: string
}

export interface SelectOption {
  value: string
  label: string
}

export interface TabItem {
  key: string
  label: string
}

export interface RadioOption {
  value: string
  label: string
}

/** S9 布局件共用：间距档（4px 网格刻度名） */
export type GapSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export type SpaceDirection = 'row' | 'column'

export type SpaceAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline'

/** OsGrid 列数上限；按窗口宽度（w-narrow/mid/wide）降档 */
export type GridColumns = 1 | 2 | 3 | 4 | 5 | 6

/** OsCollapse 面板条目；内容经 `panel-<key>` 插槽提供 */
export interface CollapseItem {
  key: string
  header: string
}

export type TypographyType = 'text' | 'title' | 'paragraph' | 'link'

/** OsSegmented 选项；icon 缺省时只渲染 label */
export interface SegmentedOption {
  value: string
  label: string
  icon?: IconName
}

/** OsDescriptions 键值条目；提供 slot 名时用该插槽自定义值 */
export interface DescriptionItem {
  key: string
  label: string
  value?: string
  slot?: string
}

/** OsTree 节点：key 为展开/选中/勾选状态的唯一标识 */
export interface TreeNode {
  key: string
  label: string
  children?: TreeNode[]
  disabled?: boolean
  /** 显式声明为叶子；不提供 children 且非叶子时配合 loadData 走懒加载 */
  isLeaf?: boolean
}

/** OsTextarea 自适应高度边界（行数）；提供 autosize 对象时按此钳制 */
export interface TextareaAutosize {
  minRows?: number
  maxRows?: number
}
