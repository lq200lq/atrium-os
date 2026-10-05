import { expect } from 'vitest'
import type { Size, Status } from '@/ui'

/**
 * S8 契约断言的唯一实现处：disabled / status / size 三项跨组件一致性
 * 由这些函数跑遍 Input/Select/Checkbox/Radio/Switch/Form，避免逐文件复制口径。
 *
 * 单位是「类名令牌」而非像素：happy-dom 不加载 Tailwind 产物，
 * getComputedStyle(el).height 与 var(--control-height-*) 实测均为空串，
 * 像素级一致性由 tests/e2e/control-height.spec.ts 在真实浏览器里断言。
 */

export const CONTROL_HEIGHT: Record<Size, string> = {
  sm: 'h-control-sm',
  md: 'h-control',
  lg: 'h-control-lg',
}

/** 非 default 状态必须出现的语义刻度类（描边取 -text，状态环取 -border） */
export const STATUS_OUTLINE: Record<Exclude<Status, 'default'>, string[]> = {
  error: ['border-danger-text', 'ring-danger-border'],
  warning: ['border-warning-text', 'ring-warning-border'],
}

/** 组件内所有元素的 class 令牌（含根元素，也捕获 disabled:is-disabled 变体写法） */
export function classTokens(root: Element): string[] {
  return [root, ...Array.from(root.querySelectorAll('*'))].flatMap((el) =>
    (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean),
  )
}

export function expectSizeContract(root: Element, size: Size): void {
  expect(classTokens(root), `size=${size}`).toContain(CONTROL_HEIGHT[size])
}

export function expectDisabledContract(root: Element): void {
  const tokens = classTokens(root)
  expect(
    tokens.some((t) => t === 'is-disabled' || t === 'disabled:is-disabled'),
    '禁用态必须是 is-disabled 唯一写法',
  ).toBe(true)
  expect(root.querySelector('[disabled]'), '原生控件必须同时真禁用').not.toBeNull()
}

export function expectStatusContract(root: Element, status: Exclude<Status, 'default'>): void {
  const tokens = classTokens(root)
  for (const token of STATUS_OUTLINE[status]) {
    expect(tokens, `status=${status} 应派生 ${token}`).toContain(token)
  }
}
