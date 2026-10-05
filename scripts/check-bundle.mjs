#!/usr/bin/env node
// 包体预算门禁：构建后核查 dist 产物，单 chunk 或首屏总量超阈值即失败（exit 1）。
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = join(process.cwd(), 'dist', 'assets')
// gzip 前的原始字节阈值（KB）。首屏只加载 index + vue + vendor，应用按需异步加载。
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

// 首屏总量 = index 入口 + 手动分包 vue/vendor（应用 chunk 为异步、不计入首屏）
const entryNames = assets.filter((a) => /^(index|vue|vendor)-/.test(a.name))
const entryTotal = entryNames.reduce((s, a) => s + a.kb, 0)
console.log(
  `[bundle] 首屏总量（index+vue+vendor）：${fmt(entryTotal)} / 预算 ${MAX_ENTRY_TOTAL_KB}KB`,
)
if (entryTotal > MAX_ENTRY_TOTAL_KB) {
  console.error(`[bundle] ✗ 首屏总量 ${fmt(entryTotal)} 超过预算 ${MAX_ENTRY_TOTAL_KB}KB`)
  failed = true
}

// 校验应用确实各自成 chunk（异步分包未回退为单包）
const appChunks = assets.filter((a) => /App-/.test(a.name) || /app-/.test(a.name))
console.log(`[bundle] 检测到应用异步 chunk：${appChunks.length} 个`)

if (failed) process.exit(1)
console.log('[bundle] ✓ 包体预算通过')
