#!/usr/bin/env node
/**
 * 图标白名单生成与校验（S11）。
 *
 * 为什么不是「全量动态解析 lucide」：实测（见 docs/AtriumOS对标AntDesign迭代规划.md §9 S11 条）
 * 把整包 barrel 拉进 vendor 会同时打爆 vendor 单块上限与首屏预算，且 lucide-vue-next 没有
 * DynamicIcon。所以保留显式子集：内核文件由本脚本维护，业务侧加图标只改组件、跑一次
 * `npm run icons:gen`，不必再手写 import。
 *
 *   node scripts/gen-icons.mjs --write   # 扫描 src/ 用到的图标名，补齐 icons.ts 白名单
 *   node scripts/gen-icons.mjs --check   # 只校验：有用到未登记的名称即退出码 1（CI 用）
 */
import { readFileSync, readdirSync, writeFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const ICONS = 'src/kernel/icons.ts'
const LUCIDE_BARREL = 'node_modules/lucide-vue-next/dist/esm/lucide-vue-next.js'

/** kebab 名 → lucide 导出名与真实导出名不一致时的显式对账表。 */
const ALIASES = {
  'alert-triangle': 'AlertTriangle',
  'loader-circle': 'LoaderCircle',
  'notebook-pen': 'NotebookPen',
  'scroll-text': 'ScrollText',
  'trash-2': 'Trash2',
}

const SRC_EXTS = ['.vue', '.ts']

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (SRC_EXTS.some((ext) => full.endsWith(ext))) out.push(full)
  }
  return out
}

/** 模板里的 <OsIcon name="…">、manifest/映射里的 icon: '…'。 */
function usedNames() {
  const found = new Set()
  for (const file of walk(join(ROOT, 'src'))) {
    if (file.endsWith(ICONS)) continue
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/<OsIcon\b[^>]*?>/g)) {
      // 只取静态 name="…"：`(?:^|\s)name=` 排除了 :name="icon" 这类动态绑定（那是变量名）
      const name = /(?:^|\s)name="([a-z0-9]+(?:-[a-z0-9]+)*)"/.exec(m[0])?.[1]
      if (name) found.add(name)
    }
    for (const m of text.matchAll(/\bicon:\s*'([a-z0-9]+(?:-[a-z0-9]+)*)'/g)) found.add(m[1])
  }
  return found
}

/** 白名单现有键（含其 lucide 导出名）。 */
function currentMap() {
  const text = readFileSync(join(ROOT, ICONS), 'utf8')
  const block = /export const ICON_MAP = \{([\s\S]*?)\} as const/.exec(text)?.[1]
  if (!block) throw new Error(`${ICONS} 结构变了：找不到 ICON_MAP 块，请同步修本脚本`)
  const map = new Map()
  for (const m of block.matchAll(/^\s*'?([a-z0-9-]+)'?:\s*([A-Z][A-Za-z0-9]*),$/gm))
    map.set(m[1], m[2])
  return map
}

const pascal = (kebab) =>
  ALIASES[kebab] ??
  kebab
    .split('-')
    .map((seg) => (/^\d/.test(seg) ? seg : seg[0].toUpperCase() + seg.slice(1)))
    .join('')

/** lucide barrel 是否真的导出该名字（避免写出运行时才炸的 import）。 */
function lucideExports() {
  if (!existsSync(LUCIDE_BARREL)) throw new Error(`找不到 ${LUCIDE_BARREL}`)
  return new Set(
    [...readFileSync(LUCIDE_BARREL, 'utf8').matchAll(/\bas ([A-Z][A-Za-z0-9]*)\b/g)].map(
      (m) => m[1],
    ),
  )
}

function main() {
  const mode = process.argv[2]
  if (mode !== '--write' && mode !== '--check') {
    console.error('用法: node scripts/gen-icons.mjs --write | --check')
    process.exit(2)
  }
  const map = currentMap()
  const exports = lucideExports()
  const used = usedNames()
  const missing = [...used].filter((name) => !map.has(name)).sort()
  const unknown = missing.filter((name) => !exports.has(pascal(name)))

  if (unknown.length) {
    console.error(`[icons] lucide 没有这些导出，检查拼写或在 ALIASES 里对账：${unknown.join(', ')}`)
    process.exit(1)
  }
  if (missing.length) {
    if (mode === '--check') {
      console.error(
        `[icons] 有用到未登记的图标：${missing.join(', ')}；跑 \`npm run icons:gen\` 后一并提交`,
      )
      process.exit(1)
    }
    for (const name of missing) map.set(name, pascal(name))
    const keys = [...map.keys()].sort()
    const imports = [...new Set(keys.map((k) => map.get(k)))].sort()
    const text = readFileSync(join(ROOT, ICONS), 'utf8')
      .replace(
        /import \{[\s\S]*?\} from 'lucide-vue-next'/,
        `import {\n${imports.map((i) => `  ${i},`).join('\n')}\n} from 'lucide-vue-next'`,
      )
      .replace(
        /export const ICON_MAP = \{[\s\S]*?\} as const/,
        `export const ICON_MAP = {\n${keys
          .map((k) => `  ${/[-\d]/.test(k) ? `'${k}'` : k}: ${map.get(k)},`)
          .join('\n')}\n} as const`,
      )
    writeFileSync(join(ROOT, ICONS), text)
    console.log(`[icons] 白名单补齐 ${missing.length} 个：${missing.join(', ')}`)
    return
  }
  console.log(`[icons] ✓ ${map.size} 个白名单图标覆盖 src/ 全部 ${used.size} 个用点`)
}

main()
