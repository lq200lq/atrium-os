#!/usr/bin/env node
/**
 * 小组件契约门禁（§9 T5 / T9 / T12 / T15，一个入口四段静态扫描，进 build:check）
 * ------------------------------------------------------------------
 *   T5  契约字段不空转：src/widgets/<id>/manifest.ts 逐件核结构，
 *       下钻列「要么给落点（openAppId 对象 + payloadFor）、要么给豁免」，
 *       「只填 appId 落首页」判不合格（docs/WebOS小组件功能设计.md §4.5、H-1）。
 *   T9  文案写法：两份语言包 widgets.descriptions.* 叶子齐平、同语言不重值，
 *       中文禁自指开头、英文句子式大写且禁 "This widget" 式自指（§4.8 H-5）。
 *   T12 配置面不越权：configEntry 指向的组件不 import kernel/stores、
 *       不含 setSize/remove(/uninstall/setEnabled，且该 kind 的 config schema 非空（§4.12）。
 *   T15 配置面不闲置：schema 每个字段两侧都在——件侧读得到（`config.value.K` / 模板 `config.K`），
 *       且验收 spec 的某个 `config:{…}` 给过非缺省值（有一条渲染腿）。缺任一侧判违规（§9 T15）。
 *
 * 用法：node scripts/check-widget-contract.mjs        # 违规即 exit 1
 *
 * 灰区口径（本门禁的解释约定，写死在此以便评审）：
 *  ① 豁免标记：manifest 注释含「下钻豁免」，允许其后带「（§x.x 引注）」之类括注，
 *     全角/半角冒号后必须有非空理由文本；命中即算「豁免」模式并打印理由，供台账复核。
 *  ② nameKey/descriptionKey 必须是 `widgets.names.<id>` / `widgets.descriptions.<id>`
 *     且两份语言包都有对应叶子——key 指向虚空也算「字段空转」，归 T5 管。
 *  ③ T12 的越权词对组件文件全文扫描（含注释与模板）：配置面板里这些词不该以
 *     任何可执行形态出现，宁严勿松；注释里提到平台动作请改述，不要加白名单。
 *  ④ configEntry 只接受 `() => import('./X.vue')` 相对形态（现状即如此）；
 *     其它写法（别名、动态拼接）本门禁解析不了＝不可审计，直接判违规而非跳过。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, relative, resolve as resolvePath } from 'node:path'

const ROOT = process.cwd()
const WIDGETS_DIR = join(ROOT, 'src/widgets')
const LOCALES = {
  'zh-CN': join(ROOT, 'src/i18n/locales/zh-CN.ts'),
  'en-US': join(ROOT, 'src/i18n/locales/en-US.ts'),
}

/** 违规收集：每条都带 file:line，最后统一打印 */
const findings = []
/** 通过侧的审计输出（T5 下钻模式表），与违规分开走 stdout */
const audit = []

function rel(file) {
  return relative(ROOT, file).split('\\').join('/')
}

function lineAt(text, index) {
  let line = 1
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === '\n') line++
  return line
}

const violation = (file, line, gate, msg) => findings.push(`${rel(file)}:${line} ${gate} ${msg}`)

// ---------------------------------------------------------------- 工具：文本块提取

/** 从 startIdx（指向 `[` 或 `{`）做括号配平，返回块原文（含首尾括号） */
function balancedBlock(text, startIdx) {
  const open = text[startIdx]
  const close = open === '[' ? ']' : '}'
  let depth = 0
  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i]
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return text.slice(startIdx, i + 1)
    }
  }
  return null
}

/** 解析语言包里一个对象字面量块的 `key: 'value'` 叶子（key 可裸可引号） */
function parseLeafBlock(text, blockStart, file) {
  const block = balancedBlock(text, blockStart)
  if (!block) throw new Error(`${rel(file)}：括号不配平，无法解析`)
  const leaves = new Map()
  const re =
    /(?:^|[\n,{])\s*((?:'[^']+'|"[^"]+"|[A-Za-z_$][\w$]*))\s*:\s*('((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g
  let m
  while ((m = re.exec(block))) {
    const key = m[1].replace(/^['"]|['"]$/g, '')
    const raw = m[3] ?? m[4]
    const value = raw.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    leaves.set(key, { value, keyPos: blockStart + m.index + m[0].indexOf(m[1]) })
  }
  return { block, leaves, offset: blockStart }
}

/** 在语言包源文里定位 `widgets:` 对象下某个子块（如 `descriptions`）的 `{` 位置 */
function findWidgetsSubBlock(src, subKey) {
  const re = new RegExp(`(^|\\n)\\s*${subKey}:\\s*\\{`)
  const m = re.exec(src)
  if (!m) return -1
  return m.index + m[0].lastIndexOf('{')
}

// ---------------------------------------------------------------- 语言包（T9）

function readLocalePack(file) {
  const src = readFileSync(file, 'utf8')
  const out = {}
  for (const sub of ['names', 'descriptions']) {
    const pos = findWidgetsSubBlock(src, sub)
    if (pos < 0) {
      violation(file, 1, '[T9]', `语言包缺 widgets.${sub} 块`)
      out[sub] = null
      continue
    }
    out[sub] = parseLeafBlock(src, pos, file)
  }
  return out
}

// ---------------------------------------------------------------- manifest 解析（T5/T12）

function parseManifest(file) {
  const src = readFileSync(file, 'utf8')
  const g = new RegExp("^\\s*id:\\s*'([^']*)'", 'm').exec(src)
  const name = /^\s*name:\s*'([^']*)'/m.exec(src)
  const nameKey = /^\s*nameKey:\s*'([^']*)'/m.exec(src)
  const descriptionKey = /^\s*descriptionKey:\s*'([^']*)'/m.exec(src)
  const sizesMatch = /widget:\s*\{[^}]*sizes:\s*\[([^\]]*)\]/.exec(src)
  const defaultSize = /widget:\s*\{[^}]*defaultSize:\s*'([^']*)'/.exec(src)
  const version = /^\s*version:\s*'([^']*)'/m.exec(src)
  const order = /^\s*order:\s*(\d+)/m.exec(src)
  const entry = /entry:\s*\(\)\s*=>\s*import\(\s*'([^']+)'\s*\)/.exec(src)
  const openAppStr = /openAppId:\s*'([^']*)'/.exec(src)
  const openAppObjStart = /openAppId:\s*\{/.exec(src)
  const configEntryMatch = /configEntry:\s*\(\)\s*=>\s*import\(\s*'([^']+)'\s*\)/.exec(src)
  const configStart = /config:\s*\[/.exec(src)

  let openAppObj = null
  if (openAppObjStart) {
    const braceIdx = openAppObjStart.index + openAppObjStart[0].lastIndexOf('{')
    const block = balancedBlock(src, braceIdx)
    openAppObj = {
      block,
      appId: block && /appId:\s*'([^']+)'/.exec(block),
      hasPayloadFor: !!block && /payloadFor/.test(block),
      line: lineAt(src, openAppObjStart.index),
    }
  }

  // 下钻豁免：注释行「下钻豁免（可带括注）：理由」
  let exemption = null
  for (const line of src.split('\n')) {
    if (!line.includes('//')) continue
    const m = /下钻豁免[^：:\n]*[：:]\s*(.+)$/.exec(line)
    if (m && m[1].trim().length > 0) {
      exemption = m[1].trim()
      break
    }
  }

  let configCount = 0
  const configKeys = []
  if (configStart) {
    const bracketIdx = configStart.index + configStart[0].lastIndexOf('[')
    const block = balancedBlock(src, bracketIdx)
    if (block) {
      const re = /\bkey:\s*'([^']+)'/g
      let hit
      while ((hit = re.exec(block)) !== null) {
        configKeys.push({ name: hit[1], line: lineAt(src, bracketIdx + hit.index) })
      }
      configCount = configKeys.length
    }
  }

  return {
    src,
    file,
    id: g && g[1],
    idLine: g && lineAt(src, g.index),
    name: name && name[1],
    nameKey: nameKey && nameKey[1],
    nameKeyLine: nameKey && lineAt(src, nameKey.index),
    descriptionKey: descriptionKey && descriptionKey[1],
    descriptionKeyLine: descriptionKey && lineAt(src, descriptionKey.index),
    sizesRaw: sizesMatch && sizesMatch[1],
    sizesLine: sizesMatch && lineAt(src, sizesMatch.index),
    sizes: sizesMatch
      ? sizesMatch[1]
          .split(',')
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean)
      : [],
    defaultSize: defaultSize && defaultSize[1],
    version: version && version[1],
    order: order && order[1],
    entrySpec: entry && entry[1],
    openAppStr: openAppStr && { value: openAppStr[1], line: lineAt(src, openAppStr.index) },
    openAppObj,
    exemption,
    configEntrySpec: configEntryMatch && {
      value: configEntryMatch[1],
      line: lineAt(src, configEntryMatch.index),
    },
    configCount,
    configKeys,
  }
}

// ---------------------------------------------------------------- T5

function checkT5(m, packs) {
  const f = m.file
  if (!m.id) {
    violation(f, 1, '[T5]', 'manifest 缺少 id 字段')
    return
  }
  if (!m.id.match(/^[a-z][a-z0-9-]*$/)) {
    violation(f, m.idLine, '[T5]', `id「${m.id}」不是 kebab-case`)
  }
  if (!m.name) violation(f, m.idLine, '[T5]', '缺 name（回退文案）')
  if (!m.nameKey) violation(f, m.idLine, '[T5]', '缺 nameKey')
  if (!m.descriptionKey) violation(f, m.idLine, '[T5]', '缺 descriptionKey')

  if (!m.sizesRaw) violation(f, 1, '[T5]', '缺 widget.sizes')
  else if (!m.sizes.length) violation(f, m.sizesLine, '[T5]', 'widget.sizes 为空数组')
  if (!m.defaultSize) violation(f, m.sizesLine ?? 1, '[T5]', '缺 widget.defaultSize')
  else if (m.defaultSize && !m.sizes.includes(m.defaultSize)) {
    violation(
      f,
      m.sizesLine ?? 1,
      '[T5]',
      `defaultSize「${m.defaultSize}」不在 sizes [${m.sizes.join(', ')}] 里`,
    )
  }

  if (!m.version) violation(f, 1, '[T5]', '缺 version')
  if (!m.order) violation(f, 1, '[T5]', '缺 order')
  if (!m.entrySpec) violation(f, 1, '[T5]', "entry 必须是 `() => import('./X.vue')` 动态导入")
  else if (!m.entrySpec.startsWith('./') || !m.entrySpec.endsWith('.vue')) {
    violation(f, 1, '[T5]', `entry 路径形态不可审计：${m.entrySpec}（只接受 './X.vue'）`)
  }

  // 灰区 ②：nameKey/descriptionKey 必须指向两份语言包都存在的叶子
  for (const [field, key, line, sub] of [
    ['nameKey', m.nameKey, m.nameKeyLine, 'names'],
    ['descriptionKey', m.descriptionKey, m.descriptionKeyLine, 'descriptions'],
  ]) {
    if (!key) continue
    const expect = `widgets.${sub}.${m.id}`
    if (key !== expect) {
      violation(f, line, '[T5]', `${field}「${key}」应为「${expect}」（与件 id 齐平）`)
      continue
    }
    for (const [packName, pack] of Object.entries(packs)) {
      const leaves = pack?.[sub]?.leaves
      if (!leaves || !leaves.has(m.id)) {
        violation(
          LOCALES[packName],
          1,
          '[T5]',
          `${expect} 在 ${packName} 语言包无叶子（契约字段空转）`,
        )
      }
    }
  }

  // 下钻列：落点（对象 + payloadFor）或豁免（注释），二选一
  if (m.openAppObj) {
    if (!m.openAppObj.appId || !m.openAppObj.appId[1]) {
      violation(f, m.openAppObj.line, '[T5]', 'openAppId 对象缺非空 appId')
    } else if (!m.openAppObj.hasPayloadFor) {
      violation(
        f,
        m.openAppObj.line,
        '[T5]',
        `openAppId「${m.openAppObj.appId[1]}」只给 appId 没给 payloadFor＝落首页（判不合格，除非写「下钻豁免：理由」）`,
      )
    } else {
      audit.push(`[T5] ${m.id}  下钻=落点 → ${m.openAppObj.appId?.[1] ?? '?'} + payloadFor`)
      return
    }
  } else if (m.openAppStr) {
    if (!m.openAppStr.value) {
      violation(f, m.openAppStr.line, '[T5]', 'openAppId 为空字符串')
    } else if (m.exemption) {
      audit.push(`[T5] ${m.id}  下钻=豁免（附裸 appId）：${m.exemption}`)
      return
    } else {
      violation(
        f,
        m.openAppStr.line,
        '[T5]',
        `openAppId: '${m.openAppStr.value}' 裸 appId 落首页＝半吊子下钻（T5/H-1），给 payloadFor 或写「下钻豁免：理由」`,
      )
    }
  } else if (m.exemption) {
    audit.push(`[T5] ${m.id}  下钻=豁免：${m.exemption}`)
    return
  } else {
    violation(
      f,
      m.idLine,
      '[T5]',
      '下钻列空白：无 openAppId+payloadFor，也无「下钻豁免：理由」注释',
    )
  }
}

// ---------------------------------------------------------------- T9

const ZH_BANNED_PREFIXES = ['此小组件', '本组件', '本小组件', '使用本', '添加此']
const EN_BANNED_PREFIXES = ['This widget', 'Use this widget', 'Add this widget']

function checkT9(packs) {
  const zh = packs['zh-CN'].descriptions
  const en = packs['en-US'].descriptions
  if (!zh || !en) return

  for (const [packName, pack] of [
    ['zh-CN', zh],
    ['en-US', en],
  ]) {
    const localeFile = LOCALES[packName]
    const src = readFileSync(localeFile, 'utf8')
    const seenValue = new Map()
    for (const [key, leaf] of pack.leaves) {
      const line = lineAt(src, leaf.keyPos)
      const value = leaf.value
      if (packName === 'zh-CN') {
        for (const p of ZH_BANNED_PREFIXES) {
          if (value.startsWith(p)) {
            violation(
              localeFile,
              line,
              '[T9]',
              `descriptions.${key} 中文自指开头「${p}…」（H-5 禁自指）`,
            )
          }
        }
      } else {
        for (const p of EN_BANNED_PREFIXES) {
          if (value.startsWith(p)) {
            violation(
              localeFile,
              line,
              '[T9]',
              `descriptions.${key} 英文自指开头「${p}…」（H-5 禁自指）`,
            )
          }
        }
        const first = value.trim().charAt(0)
        if (first && first !== first.toUpperCase()) {
          violation(
            localeFile,
            line,
            '[T9]',
            `descriptions.${key} 英文非句子式大写（首字母应大写）`,
          )
        }
      }
      const dup = seenValue.get(value)
      if (dup) {
        violation(
          localeFile,
          line,
          '[T9]',
          `descriptions.${key} 与 descriptions.${dup} 同语言重值：「${value}」`,
        )
      } else {
        seenValue.set(value, key)
      }
    }
  }

  // 两份语言包 widgets.descriptions.* 叶子集合齐平
  for (const k of zh.leaves.keys()) {
    if (!en.leaves.has(k))
      violation(LOCALES['en-US'], 1, '[T9]', `descriptions.${k} 在 en-US 缺失（齐平门禁）`)
  }
  for (const k of en.leaves.keys()) {
    if (!zh.leaves.has(k))
      violation(LOCALES['zh-CN'], 1, '[T9]', `descriptions.${k} 在 zh-CN 缺失（齐平门禁）`)
  }
}

// ---------------------------------------------------------------- T12

const CONFIG_FORBIDDEN = [
  {
    re: /from\s+['"]@\/kernel\/stores\/[^'"]*['"]/g,
    why: '禁 import kernel/stores（只准 inject/composable，§4.12）',
  },
  { re: /import\s*\(\s*['"]@\/kernel\/stores\//g, why: '禁动态 import kernel/stores' },
  { re: /\bsetSize\s*\(/g, why: '配置面不得出现平台动作 setSize' },
  { re: /\bremove\s*\(/g, why: '配置面不得出现平台动作 remove(' },
  { re: /\buninstall\s*\(/g, why: '配置面不得出现平台动作 uninstall' },
  { re: /\bsetEnabled\s*\(/g, why: '配置面不得出现平台动作 setEnabled' },
  {
    re: /['"`][^'"`\n]*(?:setSize|uninstall|setEnabled)[^'"`\n]*['"`]/g,
    why: '等价命令串（字符串里出现平台动作指令）',
  },
]

function checkT12(m) {
  if (!m.configEntrySpec) return
  const spec = m.configEntrySpec.value
  if (!spec.startsWith('./') || !spec.endsWith('.vue')) {
    violation(
      m.file,
      m.configEntrySpec.line,
      '[T12]',
      `configEntry 路径形态不可审计：'${spec}'（只接受 './X.vue'，不接受别名/动态拼接）`,
    )
    return
  }
  const target = resolvePath(m.file, '..', spec)
  if (!existsSync(target)) {
    violation(m.file, m.configEntrySpec.line, '[T12]', `configEntry 指向的文件不存在：${spec}`)
    return
  }
  const src = readFileSync(target, 'utf8')
  const lines = src.split('\n')
  let hits = 0
  lines.forEach((line, idx) => {
    for (const rule of CONFIG_FORBIDDEN) {
      rule.re.lastIndex = 0
      if (rule.re.test(line)) {
        hits++
        violation(target, idx + 1, '[T12]', rule.why)
        return
      }
    }
  })
  if (m.configCount === 0) {
    violation(
      m.file,
      m.configEntrySpec.line,
      '[T12]',
      `声明了 configEntry 但 config schema 为空（§4.12：schema 恒必填）`,
    )
  }
  if (!hits && m.configCount > 0) {
    audit.push(`[T12] ${m.id}  configEntry=${spec} · schema ${m.configCount} 项 · 无越权命中`)
  }
}

// ---------------------------------------------------------------- T15

/**
 * 配置面不闲置（§9 T15，2026-10-06 加）：schema 里声明的每一个字段必须**两侧都在**——
 * ① 件侧（该件目录下的 .vue/.ts，排除 manifest）真的读它：`config.value.K` 或模板里的
 *    `config.K` 或 `config['K']`；② `tests/e2e/widget-acceptance.spec.ts` 里**同一个 kind**
 *    的某个 `config: { … }` 给出过它，也就是有一条**渲染腿**。
 * 只补②不补①=持久化往返能过但字段是摆设；只补①不补②=字段被读但没腿，删掉那行也没人报。
 * ②按 kind 归账（不拼成一整块文本再找键名）：两个件可以同名一个字段（如都有 `hour12`），
 * 全局搜键名会让 A 件的腿替 B 件冒领，B 件的「纯摆设」就此自绿。
 * 这条门禁的由来见功能设计 §8 偏差 20 与 §9「§4.9 时钟：秒数按档封」那一段的反证记录。
 */
const ACCEPT_SPEC = join(ROOT, 'tests/e2e/widget-acceptance.spec.ts')

/** kind → 该 kind 的 config 块体数组（`kind:'x'` 与其 `config:{}` 必须在同一个对象字面量里） */
function configLegsByKind(specSrc) {
  const byKind = new Map()
  const re = /\bkind:\s*'([a-z][a-z0-9-]*)'([^{}]*?)\bconfig:\s*\{([^}]*)\}/g
  let hit
  let blockCount = 0
  while ((hit = re.exec(specSrc)) !== null) {
    const [, kind, , body] = hit
    byKind.set(kind, [...(byKind.get(kind) ?? []), body])
    blockCount += 1
  }
  return { byKind, blockCount }
}

function checkT15(m, legBlock) {
  if (!m.configKeys.length) return
  const dir = resolvePath(m.file, '..')
  const readSide = readdirSync(dir)
    .filter((f) => /\.(vue|ts)$/.test(f) && f !== 'manifest.ts')
    .map((f) => {
      const p = join(dir, f)
      return existsSync(p) ? readFileSync(p, 'utf8') : ''
    })
    .join('\n')

  const missing = []
  for (const spec of m.configKeys) {
    const key = spec.name
    const readRe = new RegExp(
      `config\\.value\\.${key}\\b|config\\.${key}\\b|config\\[['"]${key}['"]\\]`,
    )
    if (!readRe.test(readSide)) {
      violation(m.file, spec.line, '[T15]', `config 字段「${key}」件侧从未读取（纯摆设）`)
      missing.push(`${key}(读侧)`)
      continue
    }
    if (!new RegExp(`\\b${key}:`).test(legBlock)) {
      violation(
        m.file,
        spec.line,
        '[T15]',
        `config 字段「${key}」在 widget-acceptance 里没有任何 kind:'${m.id}' 的 config:{…} 给出——缺渲染腿`,
      )
      missing.push(`${key}(腿)`)
    }
  }
  if (!missing.length) {
    audit.push(`[T15] ${m.id}  schema ${m.configKeys.length} 项 · 读侧与渲染腿两侧都在`)
  }
}

// ---------------------------------------------------------------- 主流程

if (!existsSync(WIDGETS_DIR)) {
  console.error(`[widget-contract] 找不到 ${rel(WIDGETS_DIR)}，请在仓库根目录运行`)
  process.exit(1)
}

let packs
try {
  packs = {
    'zh-CN': readLocalePack(LOCALES['zh-CN']),
    'en-US': readLocalePack(LOCALES['en-US']),
  }
} catch (err) {
  console.error(`[widget-contract] ✗ 语言包解析失败：${err.message}`)
  process.exit(1)
}

const dirs = readdirSync(WIDGETS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => d.name)

const manifests = []
for (const dir of dirs) {
  const file = join(WIDGETS_DIR, dir, 'manifest.ts')
  if (!existsSync(file)) {
    violation(join(WIDGETS_DIR, dir), 1, '[T5]', '目录缺 manifest.ts')
    continue
  }
  const m = parseManifest(file)
  if (m.id && m.id !== dir) {
    violation(file, m.idLine, '[T5]', `id「${m.id}」与目录名「${dir}」不一致`)
  }
  manifests.push(m)
}

for (const m of manifests) checkT5(m, packs)
checkT9(packs)
for (const m of manifests) checkT12(m)

if (!existsSync(ACCEPT_SPEC)) {
  violation(ACCEPT_SPEC, 1, '[T15]', '找不到验收 spec，T15 无从判定（路径或文件名漂了）')
}
const { byKind: legsByKind, blockCount: legBlockCount } = existsSync(ACCEPT_SPEC)
  ? configLegsByKind(readFileSync(ACCEPT_SPEC, 'utf8'))
  : { byKind: new Map(), blockCount: 0 }
if (existsSync(ACCEPT_SPEC)) {
  audit.push(
    `[T15] 腿源  widget-acceptance 里 ${legsByKind.size} 个 kind · ${legBlockCount} 处 config:{…}（按 kind 归账，跨件同名键不互认）`,
  )
}
for (const m of manifests) checkT15(m, (legsByKind.get(m.id) ?? []).join('\n'))

// ---------------------------------------------------------------- 输出

const t5Count = findings.filter((f) => f.includes('[T5]')).length
const t9Count = findings.filter((f) => f.includes('[T9]')).length
const t12Count = findings.filter((f) => f.includes('[T12]')).length
const t15Count = findings.filter((f) => f.includes('[T15]')).length

for (const line of audit) console.log(line)

const mark = (n) => (n === 0 ? '✓' : `✗(${n})`)
console.log(
  `[widget-contract] ${manifests.length} 件 · T5 ${mark(t5Count)} · T9 ${mark(t9Count)} · T12 ${mark(t12Count)} · T15 ${mark(t15Count)}`,
)

if (findings.length) {
  console.error(`[widget-contract] ✗ 共 ${findings.length} 处违规：`)
  for (const f of findings) console.error(`  ${f}`)
  process.exit(1)
}
process.exit(0)
