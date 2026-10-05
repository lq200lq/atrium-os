#!/usr/bin/env node
/**
 * 把文档站产物同步进 public/docs/，让「文档中心」应用能用同源 iframe 打开它（决策 D2′）。
 *
 * 为什么是复制而不是代理/双服务：本仓库纯前端、无后端也不引新依赖，而 Vite 会静态服务 public/，
 * 于是 dev（`/docs/…`）、`vite preview`、以及 `dist/docs/…` 三处同源可达，构建出的 dist 天然带文档。
 * VitePress 的 base 已设为 `/docs/`（website/.vitepress/config.ts），产物内的资源路径因此能对上。
 *
 *   node scripts/embed-docs.mjs              # 缺产物就先 vitepress build，再复制
 *   node scripts/embed-docs.mjs --if-missing # public/docs 已存在则跳过（E2E 前置，避免每次都重建）
 */
import { existsSync, rmSync, cpSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const SRC = join(ROOT, 'website', '.vitepress', 'dist')
const DEST = join(ROOT, 'public', 'docs')
const INDEX = 'index.html'

if (process.argv[2] === '--if-missing' && existsSync(join(DEST, INDEX))) {
  console.log('[embed-docs] public/docs 已就绪，跳过（改文档后跑 npm run docs:embed 刷新）')
  process.exit(0)
}

// 总是重建：复用既有 dist 会拷到「上一次不同 base / 旧文档」的产物（实测踩过一次），
// 而一次 vitepress build 只要几秒，不值得为省它留下 stale 复制的坑。
console.log('[embed-docs] vitepress build website')
const bin = join(ROOT, 'node_modules', '.bin', 'vitepress')
if (!existsSync(bin)) {
  console.error('[embed-docs] 找不到本地 vitepress 可执行文件，先 npm ci')
  process.exit(1)
}
const r = spawnSync(bin, ['build', 'website'], { stdio: 'inherit' })
if (r.status !== 0) {
  console.error('[embed-docs] vitepress build 失败')
  process.exit(r.status ?? 1)
}

// 先清后拷：VitePress 的资源带 hash，残留旧 hash 文件会让「删掉一页文档」在本地看起来仍生效
rmSync(DEST, { recursive: true, force: true })
mkdirSync(DEST, { recursive: true })
cpSync(SRC, DEST, { recursive: true })

console.log(`[embed-docs] ✓ website/.vitepress/dist → public/docs（入口 /${INDEX}）`)
