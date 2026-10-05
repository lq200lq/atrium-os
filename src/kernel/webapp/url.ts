/**
 * 外部网页应用地址的校验与归一（决策 D2′ 的安全边界）。
 *
 * 这是**用户输入**进入系统的唯一入口（应用中心「网页应用」分区手填地址），所以校验放在
 * store 的写入边界上，而不是只做在表单里——表单只是体验，写入才是防线。
 *
 * 为什么是正向协议白名单：`new URL('javascript:alert(1)')` 是**能解析成功**的，
 * 反向黑名单（拦 javascript:/data:）永远在追拼写变体，正向只认 http/https 一条就够。
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

/** 地址长度上限：过长的 URL 通常是被粘贴进来的数据泥团，且会撑爆 Dock 磁贴的 title */
const MAX_LENGTH = 2048

export type UrlReject = 'empty' | 'too-long' | 'parse' | 'protocol'

export interface UrlOk {
  ok: true
  /** 归一后的绝对地址（可直接进 iframe 的 src） */
  url: string
  /** 主机名，用于应用 id 与 Spotlight 关键词 */
  host: string
}

export interface UrlFail {
  ok: false
  reason: UrlReject
}

export type UrlResult = UrlOk | UrlFail

const SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i

function tryParse(input: string): URL | null {
  try {
    return new URL(input)
  } catch {
    return null
  }
}

/**
 * `localhost:3000` 里的 `localhost:` 长得像协议其实是被省略的 host、`:` 后是端口，
 * 直接按协议解析会得到「protocol 不支持」这种答非所问的报错。判据：冒号后到下一个 `/`
 * 之间全是数字，就当 host:port 处理，补 https 再解析。
 */
function declaresScheme(trimmed: string, scheme: string | undefined): boolean {
  if (scheme === undefined) return false
  const rest = trimmed.slice(scheme.length + 1).split('/')[0]
  return !/^\d+$/.test(rest)
}

export function normalizeWebUrl(raw: string): UrlResult {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, reason: 'empty' }
  if (trimmed.length > MAX_LENGTH) return { ok: false, reason: 'too-long' }
  // 单斜杠开头是站内相对路径，而站内入口只属于内置 manifest（不来自用户输入）；
  // 补 https 会让 `/docs/x` 变成 `https://docs/x` 这种答非所问的第三方地址，所以直接拒。
  // 协议相对写法 `//host/path` 例外，它是真的想指某个 host。
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return { ok: false, reason: 'parse' }

  const scheme = SCHEME_RE.exec(trimmed)?.[1]?.toLowerCase()
  const input = declaresScheme(trimmed, scheme) ? trimmed : `https://${trimmed}`
  const parsed = tryParse(input)
  if (!parsed) return { ok: false, reason: 'parse' }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return { ok: false, reason: 'protocol' }

  // 凭证会随每次请求发到目标站点，等于替用户做了一次 basic auth 提交；嵌进第三方页面更不该留
  parsed.username = ''
  parsed.password = ''

  return { ok: true, url: parsed.toString(), host: parsed.hostname }
}

/** 拒绝原因 → 人读文案 key 的映射由消费方决定（i18n 在 UI 层），这里只给分类不写文案 */
export const REJECT_REASONS: readonly UrlReject[] = ['empty', 'too-long', 'parse', 'protocol']
