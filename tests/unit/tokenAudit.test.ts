import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const script = join(here, '../../scripts/check-tokens.mjs')
const fixtureRoot = join(here, '../fixtures/token-audit')

interface Violation {
  line: number
  rule: string
  match: string
}
interface FileReport {
  file: string
  violations: Violation[]
}
interface AuditJson {
  total: number
  report: FileReport[]
}

/** 跑审计脚本：返回 { code, json }（非零退出码不当作异常） */
function audit(root: string) {
  try {
    const out = execFileSync('node', [script, '--root', root, '--json'], { encoding: 'utf8' })
    return { code: 0, json: JSON.parse(out) as AuditJson }
  } catch (e) {
    const out = (e as { stdout?: string }).stdout ?? ''
    return { code: (e as { status?: number }).status ?? 1, json: JSON.parse(out) as AuditJson }
  }
}

function ruleIds(result: ReturnType<typeof audit>) {
  return new Set(result.json.report.flatMap((r) => r.violations.map((v) => v.rule)))
}

describe('设计 token 审计（S7 门禁）', () => {
  it('fixture 中的违规写法逐条被抓', () => {
    const result = audit(fixtureRoot)
    expect(result.code).toBe(1)
    expect(result.json.total).toBeGreaterThan(5)
    const rules = ruleIds(result)
    for (const rule of [
      'color-literal',
      'radius-scale',
      'off-grid-spacing',
      'z-literal',
      'focus-hidden',
      'disabled-opacity',
      'font-weight',
      'font-size',
      'magic-motion',
    ]) {
      expect(rules.has(rule), `规则 ${rule} 应命中`).toBe(true)
    }
    // S10 收紧：Tailwind 裸数字层级档（z-10）也要命中，不只 z-[...]
    const zMatches = result.json.report
      .flatMap((r) => r.violations)
      .filter((v) => v.rule === 'z-literal')
      .map((v) => v.match)
    expect(zMatches).toContain('z-[9999]')
    expect(
      zMatches.some((m) => /^z-\d/.test(m)),
      '裸数字档应命中 z-10',
    ).toBe(true)
  })

  it('合规写法与带理由的例外不被误报', () => {
    const result = audit(fixtureRoot)
    const good = result.json.report.find((r) => r.file.endsWith('Good.vue'))
    expect(good).toBeUndefined()
  })

  it('真实仓库无裸值违规（S7 验收口径：一致性=裸值清零）', () => {
    const result = audit(join(here, '../..'))
    const detail = result.json.report
      .map(
        (r) =>
          `${r.file}\n${r.violations.map((v) => `  L${v.line} [${v.rule}] ${v.match}`).join('\n')}`,
      )
      .join('\n')
    expect(result.json.total, `发现 ${result.json.total} 处裸值：\n${detail}`).toBe(0)
  })
})
