#!/usr/bin/env node
// 生成一个新应用骨架：src/apps/<id>/{manifest.ts,App.vue}
// 用法：
//   npm run gen:app                       交互式
//   npm run gen:app -- hello-world --name "Hello" --icon sparkles --tint "from-emerald-500 to-teal-600" --order 50 --category other
// 不引入任何额外依赖（plop 等）。
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout, exit } from 'node:process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APPS_DIR = resolve(ROOT, 'src/apps')

const ICONS = [
  'battery-full',
  'bell',
  'bot',
  'boxes',
  'check',
  'file',
  'file-spreadsheet',
  'file-text',
  'folder',
  'notebook-pen',
  'presentation',
  'puzzle',
  'scroll-text',
  'search',
  'sparkles',
  'trash-2',
  'wifi',
  'x',
]
const CATEGORIES = ['system', 'productivity', 'data', 'settings', 'other']

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next
        i++
      } else {
        args[key] = true
      }
    } else {
      args._.push(a)
    }
  }
  return args
}

const ID_RE = /^[a-z][a-z0-9-]*$/

function validateId(id) {
  if (!ID_RE.test(id)) {
    throw new Error(`非法应用 id：${id}（只允许小写字母、数字、连字符，且以字母开头）`)
  }
  return id
}

async function ask(rl, question, fallback) {
  const suffix = fallback ? `（默认 ${fallback}）` : ''
  const answer = (await rl.question(`${question}${suffix}: `)).trim()
  return answer || fallback || ''
}

async function collect() {
  const args = parseArgs(process.argv.slice(2))
  const result = {
    id: args._[0] ?? args.id ?? '',
    name: args.name ?? '',
    icon: args.icon ?? '',
    tint: args.tint ?? '',
    order: args.order ?? '',
    category: args.category ?? '',
  }

  const needPrompt = !result.id || !result.name
  if (needPrompt) {
    const rl = createInterface({ input: stdin, output: stdout })
    try {
      if (!result.id) result.id = await ask(rl, '应用 id（kebab-case，如 hello-world）')
      validateId(result.id)
      if (!result.name) result.name = await ask(rl, '显示名称', result.id)
      if (!result.icon) {
        result.icon = await ask(rl, `图标（${ICONS.join(' / ')}）`, 'sparkles')
      }
      if (!result.tint) {
        result.tint = await ask(rl, 'tint 渐变类（如 from-emerald-500 to-teal-600）', '')
      }
      if (!result.order) {
        result.order = await ask(rl, 'order 排序权重（越小越靠前）', '100')
      }
      if (!result.category) {
        result.category = await ask(rl, `分类（${CATEGORIES.join(' / ')}）`, 'other')
      }
    } finally {
      rl.close()
    }
  }

  validateId(result.id)
  return {
    id: result.id,
    name: result.name || result.id,
    icon: ICONS.includes(result.icon) ? result.icon : 'sparkles',
    tint: result.tint || '',
    order: Number.parseInt(result.order, 10) || 100,
    category: CATEGORIES.includes(result.category) ? result.category : 'other',
  }
}

function titleCase(id) {
  return id
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
}

function manifestSource(cfg) {
  const tintLine = cfg.tint ? `\n  tint: '${cfg.tint}',` : ''
  return `import type { AppManifest } from '@/kernel/stores/appRegistry'

export const manifest: AppManifest = {
  id: '${cfg.id}',
  name: '${cfg.name}',
  icon: '${cfg.icon}',${tintLine}
  entry: () => import('./App.vue'),
  window: { w: 560, h: 420, minW: 360, minH: 280 },
  singleton: true,
  dock: true,
  keywords: ['${cfg.id}'],
  version: '0.1.0',
  category: '${cfg.category}',
  order: ${cfg.order},
}
`
}

function appVueSource(cfg) {
  const name = titleCase(cfg.id)
  return `<script setup lang="ts">
import { ref } from 'vue'
import { useOS } from '@/kernel/composables/useOS'
import OsButton from '@/ui/OsButton.vue'

// 新应用只消费 kernel 暴露的 useOS()，不直接 import 其它应用（禁止跨应用依赖）
const os = useOS()
const count = ref(0)

function openAppCenter() {
  os.exec('app-center:open')
}
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-4 text-ui">
    <h2 class="text-title font-medium text-ink">${cfg.name}</h2>
    <p class="text-ink-mute">这是 ${name} 应用骨架，从 useOS() 开始接入系统能力。</p>
    <p class="text-title text-accent-strong">计数：{{ count }}</p>
    <div class="flex gap-2">
      <OsButton variant="primary" @click="count++">加一</OsButton>
      <OsButton @click="openAppCenter">打开应用中心</OsButton>
    </div>
  </div>
</template>
`
}

const cfg = await collect()
const dir = resolve(APPS_DIR, cfg.id)

if (existsSync(dir)) {
  console.error(`应用已存在：src/apps/${cfg.id}`)
  exit(1)
}

mkdirSync(dir, { recursive: true })
writeFileSync(resolve(dir, 'manifest.ts'), manifestSource(cfg))
writeFileSync(resolve(dir, 'App.vue'), appVueSource(cfg))

console.log(`已生成应用：src/apps/${cfg.id}/`)
console.log('  - manifest.ts')
console.log('  - App.vue')
console.log('无需修改 main.ts 或壳层，重启 dev server 后即自动注册。')
