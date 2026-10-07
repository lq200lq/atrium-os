#!/usr/bin/env node
/**
 * 设计 token 审计（S7 门禁）
 * ------------------------------------------------------------------
 * 扫描 src/ 下的 .vue / .ts，拦截「绕过刻度层的裸值写法」。规则与
 * docs/AtriumOS设计规范与工程基建.md 的刻度体系一一对应：
 *   ① 颜色字面量  ② 圆角裸档  ③ 小数间距（离 4px 网格）  ④ 层级裸值
 *   ⑤ 焦点隐藏    ⑥ 禁用态自写 opacity  ⑦ 字重/字号越界  ⑧ 魔法时长/缓动
 *
 * 用法：
 *   node scripts/check-tokens.mjs            # 人读格式，违规即 exit 1
 *   node scripts/check-tokens.mjs --json     # 机器读（单测用）
 *   node scripts/check-tokens.mjs --root DIR # 指定扫描根（单测 fixture 用）
 *
 * 例外写法（必须给理由，否则视为违规）：
 *   class="rounded-md" data-token-allow="per-app 品牌磁贴，规范 3.1 例外 ②"
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

const ALLOW_MARK = 'data-token-allow'

/** 扫描根（相对 cwd）下的 src 目录 */
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
      if (/\.(vue|ts)$/.test(name)) out.push(full)
    }
  }
  walk(base)
  return out
}

const RULES = [
  {
    id: 'color-literal',
    why: '颜色必须走 token（styles/tokens.css），例外见规范 3.1',
    re: /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\brgba?\(|\bhsla?\(/g,
  },
  {
    id: 'radius-scale',
    why: '圆角只能用语义档：rounded-chip/control/surface/panel/dock/full',
    re: /\brounded(?:-[a-z]+)?-(?:none|sm|md|lg|xl|2xl|3xl|4xl)\b/g,
  },
  {
    id: 'off-grid-spacing',
    why: '间距必须吸附 4px 网格：小数档（6px/2px）请改命名档（2xs/xs/sm/md/lg/xl/2xl）',
    re: /\b(?:p|x|y|t|b|l|r)(?:x|y)?-[\d.]*\.5\b|\b(?:gap|space)-(?:x|y)?-[\d.]*\.5\b/g,
  },
  {
    id: 'z-literal',
    why: '层级只能用刻度：z-desktop/window/sticky/panel/toast/overlay/float/shell（Tailwind 裸数字档 z-0~z-50 同样禁止）',
    re: /\bz-\[[^\]]+\]|\bz-\d/g,
  },
  {
    id: 'focus-hidden',
    why: '焦点必须可见（main.css 有全局 :focus-visible 环），不得 outline-none / focus:outline-none',
    re: /\b(?:focus-visible:|focus:|hover:)?outline-none\b|\[outline:none\]/g,
  },
  {
    id: 'disabled-opacity',
    why: '禁用态统一写 disabled:is-disabled',
    re: /\bdisabled:opacity-[\d.]+(?=\s|"|')|\bcursor-not-allowed\s+opacity-40\b/g,
  },
  {
    id: 'font-weight',
    why: '字重只用两档：font-regular(400) / font-strong(600)',
    re: /\bfont-(?:thin|extralight|light|medium|semibold|bold|extrabold|black)\b/g,
  },
  {
    id: 'font-size',
    why: '字号必须用语义档：text-micro/caption/ui/title/heading-1/2/3/display-1/2/3',
    re: /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)(?=[\s"'])/g,
  },
  {
    id: 'magic-motion',
    why: '时长走 duration-quick/base/slow，缓动走 ease-out/in/in-out/out-back',
    re: /\bduration-\[\d+m?s\]|\bease-\[cubic-bezier|transition-\[[^\]]*m?s[^\]]*\]/g,
  },
  {
    id: 'raw-var',
    why: '自定义 CSS 变量只在 src/styles 定义；组件内请消费 token 类',
    re: /--[a-z][a-z0-9-]*\s*:/g,
  },
  {
    id: 'palette-class',
    why: 'Tailwind 原色阶属棘轮例外（per-app 品牌色/中性面）：只减不增，收敛后跑 --update-baseline',
    re: /\b(?:bg|text|border|from|to|via|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b/g,
    ratchet: true,
  },
  {
    id: 'widget-foreground',
    // 作用域规则：只对 `src/widgets/` 下的件生效（同一写法在别处属别的子系统口径）
    scope: /(^|\/)src\/widgets\//,
    why: '桌面件前景三档走 text-widget-ink / -ink-mute / -ink-disabled（不透明灰度，A-8），文字不低于 text-caption（§10-9/§10-11）',
    re: /\btext-white\b|\btext-micro\b/g,
  },
]

/**
 * 扫一段源码。`file` 是相对扫描根的路径，**作用域规则靠它判定**（如 `scope` 只命中 `src/widgets/`）；
 * 不传时作用域规则一律跳过，所以「这段文本本身违规」与「这个文件里的这行违规」是两类断言。
 */
export function scanText(text, file = '') {
  const violations = []
  const lines = text.split('\n')
  lines.forEach((line, idx) => {
    // 行内允许例外，但必须带理由
    const allowAt = line.indexOf(ALLOW_MARK)
    if (allowAt >= 0) {
      const reason = line
        .slice(allowAt + ALLOW_MARK.length)
        .replace(/["']/g, '')
        .trim()
      if (reason.length > 3) return
    }
    for (const rule of RULES) {
      // 作用域规则只在路径匹配时生效；不传 `file`（只扫一段文本）时一律跳过
      if (rule.scope && !rule.scope.test(file)) continue
      rule.re.lastIndex = 0
      const hit = rule.re.exec(line)
      if (!hit) continue
      violations.push({
        line: idx + 1,
        rule: rule.id,
        why: rule.why,
        match: hit[0],
        text: line.trim().slice(0, 120),
      })
    }
  })
  return violations
}

const RATCHET_RULES = new Set(RULES.filter((r) => r.ratchet).map((r) => r.id))

function baselinePath(root) {
  return join(root, 'scripts/token-baseline.json')
}

function loadBaseline(root) {
  try {
    return JSON.parse(readFileSync(baselinePath(root), 'utf8'))
  } catch {
    return {}
  }
}

export function run(root) {
  const baseline = loadBaseline(root)
  const files = collectFiles(root)
  const report = []
  const counts = {}
  for (const file of files) {
    const rel = relative(root, file).split('\\').join('/')
    const all = scanText(readFileSync(file, 'utf8'), rel)
    const hard = all.filter((v) => !RATCHET_RULES.has(v.rule))
    const allowed = baseline[rel] ?? {}
    const over = []
    for (const v of all.filter((v) => RATCHET_RULES.has(v.rule))) {
      counts[rel] ??= {}
      counts[rel][v.rule] = (counts[rel][v.rule] ?? 0) + 1
      const used = (counts[rel][v.rule] ?? 0) - 1
      if (used >= (allowed[v.rule] ?? 0)) {
        over.push({ ...v, why: `${v.why}（超出基线 ${allowed[v.rule] ?? 0} 处）` })
      }
    }
    const violations = [...hard, ...over]
    if (violations.length) report.push({ file: rel, violations })
  }
  return {
    files: files.length,
    report,
    total: report.reduce((n, r) => n + r.violations.length, 0),
    ratchetCounts: counts,
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const argv = process.argv.slice(2)
  const rootIdx = argv.indexOf('--root')
  const root = rootIdx >= 0 ? argv[rootIdx + 1] : process.cwd()
  const result = run(root)

  if (argv.includes('--update-baseline')) {
    writeFileSync(baselinePath(root), `${JSON.stringify(result.ratchetCounts, null, 2)}\n`)
    console.log(
      `基线已更新：${Object.keys(result.ratchetCounts).length} 个文件，棘轮例外 ${Object.values(
        result.ratchetCounts,
      ).reduce((n, byRule) => n + Object.values(byRule).reduce((a, b) => a + b, 0), 0)} 处`,
    )
    process.exit(0)
  }

  if (argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2))
  } else if (result.total === 0) {
    console.log(`token 审计通过：${result.files} 个文件，无裸值违规`)
  } else {
    console.error(`token 审计失败：${result.files} 个文件中发现 ${result.total} 处违规\n`)
    for (const entry of result.report) {
      console.error(entry.file)
      for (const v of entry.violations) {
        console.error(`  L${v.line} [${v.rule}] ${v.match}`)
        console.error(`        ${v.why}`)
      }
      console.error('')
    }
  }
  process.exit(result.total === 0 ? 0 : 1)
}
