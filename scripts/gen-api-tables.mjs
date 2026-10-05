#!/usr/bin/env node
/**
 * 组件 API 表生成器（S11）
 *
 * 从 src/ui/*.vue 的 `<script setup>` 与模板 AST 里抽出 Props / Model / Emits / Slots，
 * 连带 types.ts 中被引用到的类型定义一起产出 Markdown 片段，供文档站 @include 引入。
 * 目的：文档里的 API 表与源码同源，改一个 props 名而忘了改文档时 `docs:build` 直接失败。
 *
 *   node scripts/gen-api-tables.mjs --write   # 生成/更新 website/.generated/api/*.md
 *   node scripts/gen-api-tables.mjs --check   # 只比对，漂移则退出码 1（docs:build / CI 用）
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const { parse } = require('vue/compiler-sfc')

const ROOT = process.cwd()
const UI_DIR = join(ROOT, 'src/ui')
const TYPES_FILE = join(UI_DIR, 'types.ts')
const OUT_DIR = join(ROOT, 'website/.generated/api')

/** 组件源文件：src/ui 顶层 SFC + 位于 src/components 的 OsIcon */
function componentFiles() {
  const ui = readdirSync(UI_DIR)
    .filter((f) => f.endsWith('.vue'))
    .map((f) => join(UI_DIR, f))
  const icon = join(ROOT, 'src/components/OsIcon.vue')
  return [...ui, ...(existsSync(icon) ? [icon] : [])].sort()
}

/** types.ts 里的具名类型声明：名字 -> 原文（含 JSDoc 注释） */
function readTypeDecls() {
  const text = readFileSync(TYPES_FILE, 'utf8')
  const src = ts.createSourceFile(TYPES_FILE, text, ts.ScriptTarget.Latest, true)
  const decls = new Map()
  for (const stmt of src.statements) {
    if (
      ts.isInterfaceDeclaration(stmt) ||
      ts.isTypeAliasDeclaration(stmt) ||
      ts.isEnumDeclaration(stmt)
    ) {
      const name = stmt.name.text
      const start = stmt.getFullStart()
      decls.set(name, text.slice(start, stmt.getEnd()).trim())
    }
  }
  return decls
}

/** 取成员上方的最后一段注释作为说明列 */
function docOf(text, node) {
  const ranges = ts.getLeadingCommentRanges(text, node.pos) ?? []
  const last = ranges.at(-1)
  if (!last) return ''
  return text
    .slice(last.pos, last.end)
    .replace(/^\/\*\*|\*\/$|^\/\*|\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\*?\s?/, '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\|/g, '\\|')
}

function typeName(node) {
  return node ? node.getText().replace(/\s+/g, ' ') : 'unknown'
}

function literalValue(node) {
  if (!node) return ''
  const t = node.getText().trim()
  if (t.startsWith("'") || t.startsWith('"')) return t
  return t.length > 40 ? t.slice(0, 37) + '…' : t
}

/** 解析 `<script setup>` 里的 defineProps / withDefaults / defineEmits / defineModel */
function parseScript(scriptText) {
  const src = ts.createSourceFile('comp.ts', scriptText, ts.ScriptTarget.Latest, true)
  const props = []
  const models = []
  const emits = []
  let propMembers = null
  let defaults = null

  const collectProps = (typeLiteral) => {
    for (const m of typeLiteral.members) {
      if (!ts.isPropertySignature(m) || !m.name) continue
      props.push({
        name: m.name.getText(),
        type: typeName(m.type),
        required: !m.questionToken,
        doc: docOf(scriptText, m),
      })
    }
  }

  const visit = (node) => {
    // withDefaults(defineProps<{...}>(), {...})
    if (
      ts.isCallExpression(node) &&
      node.expression.getText() === 'withDefaults' &&
      ts.isCallExpression(node.arguments[0]) &&
      node.arguments[0].expression.getText() === 'defineProps'
    ) {
      const typeArg = node.arguments[0].typeArguments?.[0]
      if (typeArg && ts.isTypeLiteralNode(typeArg)) propMembers = typeArg
      const second = node.arguments[1]
      if (second && ts.isObjectLiteralExpression(second)) defaults = second
    }
    // defineProps<{...}>()
    if (
      ts.isCallExpression(node) &&
      node.expression.getText() === 'defineProps' &&
      node.typeArguments?.[0] &&
      ts.isTypeLiteralNode(node.typeArguments[0])
    ) {
      propMembers = node.typeArguments[0]
    }
    // defineEmits<{ evt: [payload] }>()
    if (
      ts.isCallExpression(node) &&
      node.expression.getText() === 'defineEmits' &&
      node.typeArguments?.[0] &&
      ts.isTypeLiteralNode(node.typeArguments[0])
    ) {
      for (const m of node.typeArguments[0].members) {
        if (!ts.isPropertySignature(m) || !m.name) continue
        const tuple = m.type && ts.isTupleTypeNode(m.type) ? m.type : null
        const payload = tuple
          ? tuple.elements.map((e) => e.getText().replace(/\s+/g, ' ')).join(' · ')
          : ''
        emits.push({ name: m.name.getText(), payload, doc: docOf(scriptText, m) })
      }
    }
    // defineModel<T>('name', {...})
    if (ts.isCallExpression(node) && node.expression.getText() === 'defineModel') {
      const typeArg = node.typeArguments?.[0]
      const first = node.arguments[0]
      const named = first && ts.isStringLiteral(first) ? first.text : ''
      const opts = named ? node.arguments[1] : first
      let def = ''
      if (opts && ts.isObjectLiteralExpression(opts)) {
        for (const p of opts.properties) {
          if (ts.isPropertyAssignment(p) && p.name.getText() === 'default') {
            def = literalValue(p.initializer)
          }
        }
      }
      models.push({
        name: named ? `v-model:${named}` : 'v-model',
        type: typeArg ? typeArg.getText().replace(/\s+/g, ' ') : 'unknown',
        def,
        doc: '',
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(src)

  if (propMembers) collectProps(propMembers)

  const defaultMap = new Map()
  if (defaults) {
    for (const p of defaults.properties) {
      if (ts.isPropertyAssignment(p)) {
        defaultMap.set(p.name.getText(), literalValue(p.initializer))
      }
    }
  }
  for (const p of props) {
    if (defaultMap.has(p.name)) {
      p.default = defaultMap.get(p.name)
      p.required = false
    } else if (p.default === undefined) {
      p.default = p.required ? '—' : ''
    }
  }
  return { props, models, emits }
}

/** 模板里的插槽名 */
function parseSlots(templateText) {
  const slots = []
  const named = [...templateText.matchAll(/<slot\s+name="([^"]+)"/g)].map((m) => m[1])
  for (const n of new Set(named)) slots.push(n)
  if (/<slot(?![^>]*\sname=)[^>]*\/?>/.test(templateText)) slots.unshift('default')
  return slots
}

function referencedTypes(rows, decls) {
  const found = new Set()
  const scan = (s) => {
    for (const m of s.matchAll(/\b([A-Z][A-Za-z0-9_]*)\b/g)) {
      if (decls.has(m[1])) found.add(m[1])
    }
  }
  for (const r of rows) scan(r.type ?? '')
  return [...found].sort()
}

const esc = (s = '') => (s || '').replace(/\|/g, '\\|')

function render(file, decls) {
  const name = basename(file, '.vue')
  const { descriptor } = parse(readFileSync(file, 'utf8'), { filename: file })
  const script = descriptor.scriptSetup?.content ?? ''
  const template = descriptor.template?.content ?? ''
  const { props, models, emits } = parseScript(script)
  const slots = parseSlots(template)
  const lines = [`<!-- 由 scripts/gen-api-tables.mjs 从 ${name}.vue 生成，勿手改 -->`, '']

  if (props.length) {
    lines.push('| Prop | 类型 | 必填 | 默认 | 说明 |', '| --- | --- | --- | --- | --- |')
    for (const p of props) {
      lines.push(
        `| \`${p.name}\` | \`${esc(p.type)}\` | ${p.required ? '是' : '否'} | ${p.default ? (p.default === '—' ? '—' : `\`${p.default}\``) : '—'} | ${esc(p.doc)} |`,
      )
    }
    lines.push('')
  }
  if (models.length) {
    lines.push('**Model**', '', '| 绑定 | 类型 | 默认 |', '| --- | --- | --- |')
    for (const m of models) {
      lines.push(`| \`${m.name}\` | \`${esc(m.type)}\` | ${m.def ? `\`${m.def}\`` : '—'} |`)
    }
    lines.push('')
  }
  if (emits.length) {
    lines.push('**Emits**', '', '| 事件 | 载荷 | 说明 |', '| --- | --- | --- |')
    for (const e of emits) {
      lines.push(`| \`${e.name}\` | ${e.payload ? `\`${esc(e.payload)}\`` : '—'} | ${esc(e.doc)} |`)
    }
    lines.push('')
  }
  if (slots.length) {
    lines.push('**Slots**', '', slots.map((s) => `- \`${s}\``).join('\n'), '')
  }

  const refs = referencedTypes([...props, ...models, ...emits], decls)
  if (refs.length) {
    lines.push(
      '**引用类型**（`src/ui/types.ts`）',
      '',
      '```ts',
      ...refs.map((r) => decls.get(r)),
      '```',
      '',
    )
  }
  return lines.join('\n')
}

function main() {
  const mode = process.argv[2]
  if (mode !== '--write' && mode !== '--check') {
    console.error('用法: node scripts/gen-api-tables.mjs --write | --check')
    process.exit(2)
  }
  const decls = readTypeDecls()
  const files = componentFiles()
  const out = files.map((f) => [join(OUT_DIR, `${basename(f, '.vue')}.md`), render(f, decls)])

  if (mode === '--check') {
    const drift = []
    for (const [path, text] of out) {
      const disk = existsSync(path) ? readFileSync(path, 'utf8') : null
      if (disk !== text) drift.push(basename(path))
    }
    const extra = existsSync(OUT_DIR)
      ? readdirSync(OUT_DIR).filter(
          (f) => f.endsWith('.md') && !out.some(([p]) => basename(p) === f),
        )
      : []
    if (drift.length || extra.length) {
      if (drift.length) console.error(`[api-tables] 与源码不一致：${drift.join(', ')}`)
      if (extra.length) console.error(`[api-tables] 源码已无这些组件：${extra.join(', ')}`)
      console.error('[api-tables] 请跑 `npm run docs:gen` 后一并提交')
      process.exit(1)
    }
    console.log(`[api-tables] ✓ ${out.length} 个组件的 API 表与源码一致`)
    return
  }

  mkdirSync(OUT_DIR, { recursive: true })
  for (const [path, text] of out) writeFileSync(path, text)
  console.log(`[api-tables] 已生成 ${out.length} 个组件 API 表 → website/.generated/api/`)
}

main()
