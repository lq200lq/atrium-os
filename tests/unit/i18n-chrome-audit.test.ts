import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const script = join(here, '../../scripts/check-i18n-chrome.mjs')
const fixtureRoot = join(here, '../fixtures/i18n-chrome')

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

describe('i18n chrome 审计', () => {
  it('fixture 里的硬编码逐条被抓，且行号折算回文件行号', () => {
    const result = audit(fixtureRoot)
    expect(result.code).toBe(1)
    const bad = result.json.report.find((r) => r.file.endsWith('Bad.vue'))
    expect(bad, 'Bad.vue 应在报告中').toBeDefined()
    const violations = bad!.violations
    // 行号对应 Bad.vue 实际文件行：文本节点 / 静态属性 / 插值各一条
    expect(violations.map((v) => v.line).sort((a, b) => a - b)).toEqual([4, 5, 6])
    expect(violations.every((v) => v.rule === 'cjk-chrome')).toBe(true)
    const matches = violations.map((v) => v.match)
    expect(matches).toContain('硬编码按钮')
    expect(matches).toContain('删除文件')
    expect(matches).toContain('插值里的默认中文')
  })

  it('注释、t() 键、变量插值与带理由的行内豁免不误报', () => {
    const result = audit(fixtureRoot)
    const good = result.json.report.find((r) => r.file.endsWith('Good.vue'))
    expect(good, `Good.vue 不该被报：${JSON.stringify(good)}`).toBeUndefined()
  })

  it('真实仓库无界面中文硬编码（门禁主判据）', () => {
    const result = audit(join(here, '../..'))
    const detail = result.json.report
      .map(
        (r) =>
          `${r.file}\n${r.violations.map((v) => `  L${v.line} [${v.rule}] ${v.match}`).join('\n')}`,
      )
      .join('\n')
    expect(result.json.total, `发现 ${result.json.total} 处硬编码：\n${detail}`).toBe(0)
  })
})
