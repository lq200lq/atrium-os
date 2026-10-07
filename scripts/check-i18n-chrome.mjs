#!/usr/bin/env node
/**
 * i18n chrome 审计（门禁）
 * ------------------------------------------------------------------
 * 扫描 src/ 下 .vue 的根 <template> 段，拦截「绕过 t() 的界面中文硬编码」。
 *
 * 口径（S11 定案）：界面 chrome（按钮/标题/占位/空态/确认文案）必须走 t()；
 * 演示数据（文件名、种子行、预置正文）留在 <script> 或数据源里，本门禁不扫
 * script 段——那里 CJK 天然合法。
 *
 * 规则：模板段（剔除 HTML 注释后）任何 CJK 即违规。插值表达式里的中文字面量
 * 同样命中（`{{ x ?? '默认中文' }}` 是 chrome）；变量引用与 t() 键都是 ASCII，
 * 不会误报。
 *
 * 例外（必须给理由）：
 *   ① 行内  data-i18n-allow="理由"      —— 单行豁免（理由 >3 字）
 *   ② 文件级 scripts/i18n-chrome-allow.json —— 整文件豁免（键为相对路径）
 *
 * 用法：
 *   node scripts/check-i18n-chrome.mjs            # 人读格式，违规即 exit 1
 *   node scripts/check-i18n-chrome.mjs --json     # 机器读（单测用）
 *   node scripts/check-i18n-chrome.mjs --root DIR # 指定扫描根（单测 fixture 用）
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

const ALLOW_MARK = 'data-i18n-allow'
const CJK = /[一-鿿]/

/** 扫描根（相对 cwd）下的 src 目录，只取 .vue（script 段不参与判定） */
function collectFiles(root) {
  const base = join(root, 'src')
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) {
        if (name === 'node_modules' || name.startsWith('.')) continue
        walk(full)
        continue
      }
      if (name.endsWith('.vue')) out.push(full)
    }
  }
  walk(base)
  return out
}

/**
 * 取根 <template> 的内容（含嵌套插槽模板），返回 { text, lineOffset }。
 * lineOffset = 模板内容首行在 SFC 里的行号 - 1，用于把违规行号折算回文件行号。
 */
function extractTemplate(src) {
  const open = src.indexOf('<template')
  if (open < 0) return null
  const close = src.lastIndexOf('</template>')
  if (close < open) return null
  const contentStart = src.indexOf('>', open) + 1
  if (contentStart <= 0) return null
  const lineOffset = src.slice(0, contentStart).split('\n').length - 1
  return { text: src.slice(contentStart, close), lineOffset }
}

/** 剔除 HTML 注释但保留换行，行号不漂移 */
function stripComments(tpl) {
  return tpl.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
}

function loadAllowlist(root) {
  try {
    return JSON.parse(readFileSync(join(root, 'scripts/i18n-chrome-allow.json'), 'utf8'))
  } catch {
    return {}
  }
}

export function run(root) {
  const allow = loadAllowlist(root)
  const files = collectFiles(root)
  const report = []
  for (const file of files) {
    const rel = relative(root, file).split('\\').join('/')
    if (allow[rel]) continue
    const tpl = extractTemplate(readFileSync(file, 'utf8'))
    if (!tpl) continue
    const violations = []
    stripComments(tpl.text)
      .split('\n')
      .forEach((line, idx) => {
        const markAt = line.indexOf(ALLOW_MARK)
        if (markAt >= 0) {
          const reason = line
            .slice(markAt + ALLOW_MARK.length)
            .replace(/["']/g, '')
            .trim()
          if (reason.length > 3) return
        }
        if (!CJK.test(line)) return
        violations.push({
          line: tpl.lineOffset + idx + 1,
          rule: 'cjk-chrome',
          match: line.match(/[一-鿿]+/)?.[0] ?? '',
          text: line.trim().slice(0, 120),
        })
      })
    if (violations.length) report.push({ file: rel, violations })
  }
  return {
    files: files.length,
    report,
    total: report.reduce((n, r) => n + r.violations.length, 0),
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const argv = process.argv.slice(2)
  const rootIdx = argv.indexOf('--root')
  const root = rootIdx >= 0 ? argv[rootIdx + 1] : process.cwd()
  const result = run(root)

  if (argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2))
  } else if (result.total === 0) {
    console.log(`i18n chrome 审计通过：${result.files} 个文件，界面中文全部走 t()`)
  } else {
    console.error(
      `i18n chrome 审计失败：${result.files} 个文件中发现 ${result.total} 处中文硬编码\n`,
    )
    for (const entry of result.report) {
      console.error(entry.file)
      for (const v of entry.violations) {
        console.error(`  L${v.line} [${v.rule}] ${v.match}`)
        console.error(
          `        界面 chrome 必须走 t()；演示数据请放 <script> 或加 data-i18n-allow="理由"`,
        )
      }
      console.error('')
    }
  }
  process.exit(result.total === 0 ? 0 : 1)
}
