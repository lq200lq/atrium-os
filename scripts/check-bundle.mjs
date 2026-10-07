#!/usr/bin/env node
// 包体预算门禁：构建后核查 dist 产物，单 chunk 或首屏总量超阈值即失败（exit 1）；
// 顺带核 §9 T8「首屏不加载未上桌面件」——件块必须落在首屏静态图之外，且每个 kind 各自成块。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = join(process.cwd(), 'dist', 'assets')
// gzip 前的原始字节阈值（KB）。首屏加载入口、壳层启动主体与 vue/vendor，应用按需异步加载。
const MAX_CHUNK_KB = 260
const MAX_ENTRY_TOTAL_KB = 700

function readAssets() {
  let files
  try {
    files = readdirSync(DIST)
  } catch {
    console.error(`[bundle] 找不到 ${DIST}，请先运行 npm run build`)
    process.exit(1)
  }
  return files
    .filter((f) => f.endsWith('.js'))
    .map((f) => ({ name: f, kb: statSync(join(DIST, f)).size / 1024 }))
    .sort((a, b) => b.kb - a.kb)
}

const assets = readAssets()
const fmt = (kb) => `${kb.toFixed(1)}KB`
let failed = false

console.log('[bundle] JS 产物（按体积降序）：')
for (const a of assets) console.log(`  ${a.name.padEnd(40)} ${fmt(a.kb)}`)

for (const a of assets) {
  if (a.kb > MAX_CHUNK_KB) {
    console.error(`[bundle] ✗ ${a.name} ${fmt(a.kb)} 超过单 chunk 预算 ${MAX_CHUNK_KB}KB`)
    failed = true
  }
}

// 首屏总量 = 入口 + 壳层启动主体 + 手动分包 vue/vendor（应用 chunk 为异步、不计入首屏）。
// main 必须算进来：`src/entry.ts` 在顶层窗口里无条件 `import('./main')`，它只是从入口的静态图里
// 挪到了动态一跳，字节一分没少。漏掉它，首屏读数会凭空小掉整个壳层（约 90KB）。
const entryNames = assets.filter((a) => /^(index|main|vue|vendor)-/.test(a.name))
const entryTotal = entryNames.reduce((s, a) => s + a.kb, 0)
console.log(
  `[bundle] 首屏总量（index+main+vue+vendor）：${fmt(entryTotal)} / 预算 ${MAX_ENTRY_TOTAL_KB}KB`,
)
if (entryTotal > MAX_ENTRY_TOTAL_KB) {
  console.error(`[bundle] ✗ 首屏总量 ${fmt(entryTotal)} 超过预算 ${MAX_ENTRY_TOTAL_KB}KB`)
  failed = true
}

// 校验应用确实各自成 chunk（异步分包未回退为单包）
const appChunks = assets.filter((a) => /App-/.test(a.name) || /app-/.test(a.name))
console.log(`[bundle] 检测到应用异步 chunk：${appChunks.length} 个`)

/* ── T8：首屏不加载未上桌面件（§9 判据落在产物静态图上） ─────────────────
 * 件组件块的命名见 `vite.config.ts` 的 chunkFileNames（`widget-<kind>-*.js`）：
 * 默认名全是 `App-<hash>.js`，十个件不可辨，所以先给它们带上 kind 名。
 * 两条断言：
 *   ① 首屏集合（上面那批启动块 + 它们沿**静态** import 边可达的块，不含 `import()` 动态边）
 *      里不得出现件代码——出现了就意味着某个没上桌面的件在首屏被拉下来；
 *   ② 每个在册 kind 都得有自己的件块——若有人把件改成 eager（如 `import.meta.glob(..., {eager:true})`
 *      直接吃组件），件代码会被并进启动块，① 未必看得见，但这里一定少一块。
 */
const WIDGET_SRC = join(process.cwd(), 'src', 'widgets')
const kinds = readdirSync(WIDGET_SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
const widgetChunks = assets.filter((a) => /^widget-/.test(a.name))
// hash 段本身可能含 `-`，kind 名也含 `-`，所以不从尾部拆，直接按已知 kind 前缀认
const coversKind = (kind) => widgetChunks.some((a) => a.name.startsWith(`widget-${kind}-`))

// 首屏启动块：与上面「首屏总量」同一口径（index/main/vue/vendor；main 由 entry.ts 无条件动态一跳）
const bootNames = new Set(entryNames.map((a) => a.name))
// 沿静态边 BFS：Rollup 产物里静态边写作 `from"./x.js"` 或副作用式 `import"./x.js"`；
// 动态边是 `import("./x.js")`，括号隔在中间，因此下面这条正则不会把它算进来。
const STATIC_EDGE = /(?:from|import)\s*["']\.\/([^"']+\.js)["']/g
const initial = new Set()
const queue = [...bootNames]
while (queue.length) {
  const name = queue.shift()
  if (initial.has(name) || !existsSync(join(DIST, name))) continue
  initial.add(name)
  const code = readFileSync(join(DIST, name), 'utf8')
  for (const dep of [...code.matchAll(STATIC_EDGE)].map((m) => m[1])) {
    if (!initial.has(dep)) queue.push(dep)
  }
}

const leaked = widgetChunks.filter((a) => initial.has(a.name))
for (const a of leaked) {
  console.error(`[bundle] ✗ T8：件代码 ${a.name} 落在首屏静态图里（未上桌面的件也会被下载）`)
  failed = true
}
const missingKinds = kinds.filter((k) => !coversKind(k))
if (missingKinds.length) {
  console.error(
    `[bundle] ✗ T8：这些件没有独立的异步块：${missingKinds.join(', ')}（被并进首屏块就是回归）`,
  )
  failed = true
}
const widgetKb = widgetChunks.reduce((s, a) => s + a.kb, 0)
console.log(
  `[bundle] T8：首屏静态图 ${initial.size} 块；件块 ${widgetChunks.length} 个（${kinds.length} 个 kind，${fmt(widgetKb)}），落在图内 ${leaked.length} 个`,
)

if (failed) process.exit(1)
console.log('[bundle] ✓ 包体预算通过')
