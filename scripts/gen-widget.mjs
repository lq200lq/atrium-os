#!/usr/bin/env node
// 生成一个新的桌面小组件骨架：src/widgets/<id>/{manifest.ts,App.vue,preview.json}
// 并把它进两份语言包（widgets.names.* / widgets.descriptions.*），最后跑一遍契约门禁（T5/T9/T12）。
// 用法：
//   npm run gen:widget                                 交互式
//   npm run gen:widget -- world-clock --name "世界时钟" --icon clock --sizes sm,md --default-size md --order 60
//   可选：--desc-zh "看现在的世界时间" --desc-en "Check world time" --open-app settings
// 不引入任何额外依赖（plop 等），与 scripts/gen-app.mjs 同构。
// T11 准入答卷：manifest 顶部自动带出「主结论 / 变化来源 / 下钻落点或豁免 / 配置数 ≤3」四格空模板，
// 四格填不满（人工评审项）就不进 §4.9 清单。
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { spawnSync } from 'node:child_process'
import { stdin, stdout, exit } from 'node:process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WIDGETS_DIR = resolve(ROOT, 'src/widgets')
const LOCALE_FILES = {
  'zh-CN': resolve(ROOT, 'src/i18n/locales/zh-CN.ts'),
  'en-US': resolve(ROOT, 'src/i18n/locales/en-US.ts'),
}

// 取值范围必须是 src/kernel/icons.ts 的 ICON_MAP 子集，且已被 icons:gen 收进白名单
const ICONS = [
  'bell',
  'book-open',
  'calendar',
  'check',
  'clock',
  'file-text',
  'globe',
  'layout-grid',
  'puzzle',
  'search',
  'sparkles',
  'user',
]
const SIZES = ['sm', 'md', 'lg']

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
    throw new Error(`非法小组件 id：${id}（只允许小写字母、数字、连字符，且以字母开头）`)
  }
  return id
}

async function ask(rl, question, fallback) {
  const suffix = fallback ? `（默认 ${fallback}）` : ''
  const answer = (await rl.question(`${question}${suffix}: `)).trim()
  return answer || fallback || ''
}

function normalizeSizes(raw) {
  const wanted = String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => SIZES.includes(s))
  const unique = [...new Set(wanted)]
  return unique.length ? unique : ['sm']
}

function titleCase(id) {
  return id
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
}

async function collect() {
  const args = parseArgs(process.argv.slice(2))
  const result = {
    id: args._[0] ?? args.id ?? '',
    name: args.name ?? '',
    icon: args.icon ?? '',
    tint: args.tint ?? '',
    sizes: args.sizes ?? '',
    defaultSize: args['default-size'] ?? '',
    order: args.order ?? '',
    openApp: args['open-app'] ?? '',
    descZh: args['desc-zh'] ?? '',
    descEn: args['desc-en'] ?? '',
    singleton: args.singleton === true,
  }

  const needPrompt = !result.id || !result.name
  if (needPrompt) {
    const rl = createInterface({ input: stdin, output: stdout })
    try {
      if (!result.id) result.id = await ask(rl, '小组件 id（kebab-case，如 world-clock）')
      validateId(result.id)
      if (!result.name) result.name = await ask(rl, '显示名称', result.id)
      if (!result.icon) result.icon = await ask(rl, `图标（${ICONS.join(' / ')}）`, 'sparkles')
      if (!result.tint) {
        result.tint = await ask(
          rl,
          'tint 渐变类（如 from-slate-600 to-slate-700；白前景对渐变端点要 ≥4.5:1，amber/sky/emerald 这类浅色相从 700 档起——判据见 tile-contrast 门禁）',
          '',
        )
      }
      if (!result.sizes)
        result.sizes = await ask(rl, `尺寸档（${SIZES.join(' / ')}，逗号分隔）`, 'sm,md')
      if (!result.defaultSize) {
        result.defaultSize = await ask(rl, '初始尺寸档', normalizeSizes(result.sizes)[0])
      }
      if (!result.order) result.order = await ask(rl, 'order 排序权重（越小越靠前）', '100')
      if (!result.openApp) {
        result.openApp = await ask(rl, '下钻目标 appId（留空＝走「下钻豁免：理由」模板）', '')
      }
      if (!result.singleton) {
        result.singleton = (await ask(rl, '桌面只允许一个实例？(y/N)', 'n')).toLowerCase() === 'y'
      }
    } finally {
      rl.close()
    }
  }

  validateId(result.id)
  const sizes = normalizeSizes(result.sizes)
  // 英文名：en-US 的 widgets.names 叶子不能用中文（names 齐平去重门禁按语言各自看）
  const nameEn =
    args['name-en'] ||
    titleCase(result.id)
      .replace(/([A-Z])/g, ' $1')
      .trim()
  // T9 模板：动词开头、禁自指；author 之后要改成贴件的一句话
  const descZh =
    result.descZh || `查看${result.name || result.id}的内容（TODO：改成动词开头的一句话）`
  const descEn = result.descEn || `Check the ${nameEn} at a glance. (TODO: rewrite verb-first)`
  return {
    id: result.id,
    name: result.name || result.id,
    nameEn,
    icon: ICONS.includes(result.icon) ? result.icon : 'sparkles',
    tint: result.tint || '',
    sizes,
    defaultSize: sizes.includes(result.defaultSize) ? result.defaultSize : sizes[0],
    order: Number.parseInt(result.order, 10) || 100,
    openApp: result.openApp || '',
    descZh,
    descEn,
    singleton: Boolean(result.singleton),
  }
}

function manifestSource(cfg) {
  const tintLine = cfg.tint ? `\n  tint: '${cfg.tint}',` : ''
  const singletonLine = cfg.singleton ? '\n  singleton: true,' : ''
  // T5 下钻列：给了 appId 就出对象形态（appId + payloadFor 空模板），
  // 没给就出「下钻豁免：」模板——两种都必须由 author 把 TODO 换成真答案。
  const drillLine = cfg.openApp
    ? `\n  openAppId: {\n    appId: '${cfg.openApp}',\n    // TODO(T5/H-1)：给下钻构造器，落在具体内容上（参数 ctx = { size, config, selected }，需要时加回形参）\n    payloadFor: () => ({ /* TODO: 下钻参数 */ }),\n  },`
    : `\n  // 下钻豁免：TODO 写明豁免理由（§4.9 准入第 3 条：卡片内容本身就是答案才可豁免）`
  const sizes = cfg.sizes.map((s) => `'${s}'`).join(', ')
  return `import type { WidgetManifest } from '@/kernel/stores/widgetRegistry'

/**
 * 准入答卷（§4.9 考卷 / T11，人工评审项）——四格都非空才可进清单：
 * - 主结论（用户扫一眼拿走什么）：
 * - 变化来源（它凭什么不是一张静态贴纸）：
 * - 下钻落点或豁免（payload 形状 / 豁免理由）：
 * - 配置数（H-9：≤3，当前 schema 0 项）：
 */
export const manifest: WidgetManifest = {
  id: '${cfg.id}',
  name: '${cfg.name}',
  nameKey: 'widgets.names.${cfg.id}',
  descriptionKey: 'widgets.descriptions.${cfg.id}',
  description: '${cfg.descZh.replace(/'/g, "\\'")}',
  icon: '${cfg.icon}',${tintLine}
  entry: () => import('./App.vue'),
  widget: { sizes: [${sizes}], defaultSize: '${cfg.defaultSize}' },${singletonLine}
  keywords: ['${cfg.id}'], // TODO: 补搜索词（中英都要有，管理面搜索只消费这一个数组）
  // 配置 schema（§4.12 恒必填；每加一项去两份语言包 widgets.config.* 补 label，齐平门禁 T7）
  config: [],${drillLine}
  version: '0.1.0',
  order: ${cfg.order},
}
`
}

function widgetVueSource(cfg) {
  return `<script setup lang="ts">
import { useWidgetContext } from '@/kernel/composables/useWidgetContext'

// 卡片材质（玻璃底/圆角/阴影）与内边距都由壳层的 WidgetFrame 提供，这里只渲染内容，
// 所以根节点不带 padding（指南 §10-2）。自有数据走 useWidgetData()（寻址由宿主解出，件不拼路径），
// 显示层心跳走 useWidgetTick()，取数节奏看 manifest.refresh，系统能力走 useOS()——件不 import 别的件/应用。
const { size } = useWidgetContext()
</script>

<template>
  <div class="flex h-full min-h-0 flex-col justify-center gap-2xs">
    <!-- 前景三级只用 text-widget-ink / -ink-mute（禁裸 \`opacity-*\`），文字不低于 text-caption（禁 \`text-micro\`）：指南 §10-9、§10-11 -->
    <p class="text-title font-strong text-widget-ink">${cfg.name}</p>
    <p class="text-caption text-widget-ink-mute">
      TODO：这一档（{{ size }}）的内容预算——放什么、放几行、放不下怎么办（§4.4 R1）。
    </p>
  </div>
</template>
`
}

/** preview.json 样例桩：键与 manifest.data 对齐（§4.8 预览沙箱的数据源） */
function previewSource() {
  return `{
  "_todo": "预览样例：键与 manifest.data 声明对齐（§4.8）；无自有数据的件保留空对象即可"
}
`
}

// ------------------------------------------------------------ 语言包写入

function quoteKey(id) {
  return /^[a-z][a-z0-9_]*$/.test(id) ? id : `'${id}'`
}

function esc(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/** 在语言包 widgets.<block> 对象块尾部插一行；已存在同键则报错退出（幂等护栏） */
function insertLocaleLeaf(file, block, id, value) {
  const src = readFileSync(file, 'utf8')
  const open = new RegExp(`(^|\\n)\\s*${block}:\\s*\\{`).exec(src)
  if (!open) {
    console.error(`语言包缺 widgets.${block} 块：${file}`)
    exit(1)
  }
  const braceIdx = open.index + open[0].lastIndexOf('{')
  let depth = 0
  let closeIdx = -1
  for (let i = braceIdx; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) {
        closeIdx = i
        break
      }
    }
  }
  if (closeIdx < 0) {
    console.error(`widgets.${block} 块括号不配平：${file}`)
    exit(1)
  }
  const body = src.slice(braceIdx + 1, closeIdx)
  if (new RegExp(`(^|[\\n,{])\\s*'?${id}'?\\s*:`).test(body)) {
    console.error(`语言包已有 widgets.${block}.${id}，中止（避免重复键）：${file}`)
    exit(1)
  }
  // 缩进跟着闭合行的缩进走：叶子 = 闭合行缩进 + 2 空格
  const before = src.slice(0, closeIdx)
  const closeIndent = /\n([ \t]*)$/.exec(before)?.[1] ?? ''
  const indent = `${closeIndent}  `
  let trimmed = before.replace(/\s+$/, '')
  if (!trimmed.endsWith(',') && !trimmed.endsWith('{')) trimmed += ','
  const line = `${indent}${quoteKey(id)}: '${esc(value)}',`
  writeFileSync(file, `${trimmed}\n${line}\n${closeIndent}${src.slice(closeIdx)}`)
}

// ------------------------------------------------------------ 主流程

const cfg = await collect()
const dir = resolve(WIDGETS_DIR, cfg.id)

if (existsSync(dir)) {
  console.error(`小组件已存在：src/widgets/${cfg.id}`)
  exit(1)
}

mkdirSync(dir, { recursive: true })
writeFileSync(resolve(dir, 'manifest.ts'), manifestSource(cfg))
writeFileSync(resolve(dir, 'App.vue'), widgetVueSource(cfg))
writeFileSync(resolve(dir, 'preview.json'), previewSource())

// T11/T9：文案叶子必须两份语言包同时进（只进一边会立刻踩齐平门禁）
insertLocaleLeaf(LOCALE_FILES['zh-CN'], 'names', cfg.id, cfg.name)
insertLocaleLeaf(LOCALE_FILES['en-US'], 'names', cfg.id, cfg.nameEn)
insertLocaleLeaf(LOCALE_FILES['zh-CN'], 'descriptions', cfg.id, cfg.descZh)
insertLocaleLeaf(LOCALE_FILES['en-US'], 'descriptions', cfg.id, cfg.descEn)

console.log(`已生成小组件：src/widgets/${cfg.id}/`)
console.log('  - manifest.ts（含 T11 准入答卷四格空模板）')
console.log('  - App.vue')
console.log('  - preview.json（预览样例桩）')
console.log('  - 语言包：widgets.names.* 与 widgets.descriptions.* 已写 zh-CN / en-US 两份')
console.log('无需修改 main.ts 或壳层，重启 dev server 后即自动注册；')
console.log('桌面右键「添加小组件」即可把它放到桌面。')

console.log('\nauthor 还须手工完成（门禁与评审会拦）：')
console.log('  1. 填 manifest 顶部准入答卷四格（T11，空即评审否决）；')
console.log(`  2. 下钻列把 TODO 换成真答案：payloadFor 参数（T5）或「下钻豁免：理由」；`)
console.log(
  "  3. 每加一个 config 项，在两份语言包 widgets.config.* 各补一条 <key>: '文案'（T7 齐平）；",
)
console.log(`  4. 把 widgets.descriptions.${cfg.id} 的模板句改成动词开头的一句话（T9）；`)
console.log('  5. 若声明 manifest.data，把 preview.json 的键对齐样例数据（§4.8）。')
console.log(
  '  6. `tint` 那行是一处 palette-class 棘轮命中（新文件 0 容忍）：npm run check:tokens 会拦，',
)
console.log(
  '     确认要留这个品牌色后跑 `node scripts/check-tokens.mjs --update-baseline` 记进基线；',
)
console.log(
  '     白前景对渐变端点须 ≥4.5:1（tile-contrast 门禁逐行量），amber/sky/emerald 从 700 档起。',
)

// T11 (d)：生成即体检——跑契约门禁， violations 由 author 负责清零
console.log('\n运行契约门禁 check-widget-contract（T5/T9/T12）…')
const check = spawnSync(process.execPath, ['scripts/check-widget-contract.mjs'], {
  cwd: ROOT,
  stdio: 'inherit',
})
if (check.status !== 0) {
  console.error(
    `\n[gen-widget] 门禁未过：请把上面对话列出的违规清零（重点是 src/widgets/${cfg.id}/ 的新件），再提交。`,
  )
} else {
  console.log(`[gen-widget] 门禁通过：src/widgets/${cfg.id} 结构合格，记得补答卷与下钻答案。`)
}
