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
