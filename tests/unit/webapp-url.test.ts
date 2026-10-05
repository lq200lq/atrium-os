import { describe, expect, it } from 'vitest'
import { normalizeWebUrl } from '@/kernel/webapp/url'

describe('normalizeWebUrl 协议白名单与归一', () => {
  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'JAVASCRIPT:alert(1)',
    '  javascript:alert(1)  ',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://example.com/uuid',
    'view-source:https://example.com',
    'about:blank',
  ])('拒绝非 http(s) 协议：%s', (raw) => {
    expect(normalizeWebUrl(raw)).toEqual({ ok: false, reason: 'protocol' })
  })

  it('空与纯空白都是 empty', () => {
    expect(normalizeWebUrl('')).toEqual({ ok: false, reason: 'empty' })
    expect(normalizeWebUrl('   \n ')).toEqual({ ok: false, reason: 'empty' })
  })

  it('超长地址在解析前就拒（不给解析器喂数据泥团）', () => {
    expect(normalizeWebUrl(`https://a.com/?q=${'x'.repeat(2048)}`)).toEqual({
      ok: false,
      reason: 'too-long',
    })
  })

  it('站内相对路径直接拒（同源入口只属于内置 manifest，不来自用户输入）', () => {
    // 补 https 会让 `/docs/index.html` 变成 `https://docs/index.html`——一个答非所问的第三方地址
    expect(normalizeWebUrl('/docs/index.html')).toEqual({ ok: false, reason: 'parse' })
    // 协议相对写法是真的想指某个 host，放行
    expect(normalizeWebUrl('//example.com/x')).toMatchObject({
      ok: true,
      url: 'https://example.com/x',
    })
  })

  it('无点单标签主机名不拦（内网 NetBIOS 名确实存在，误判成本比漏判高）', () => {
    expect(normalizeWebUrl('docs/index.html')).toMatchObject({
      ok: true,
      url: 'https://docs/index.html',
      host: 'docs',
    })
  })

  it('解析不出 host 的写法归为 parse', () => {
    expect(normalizeWebUrl('a b c')).toEqual({ ok: false, reason: 'parse' })
    expect(normalizeWebUrl('https://')).toEqual({ ok: false, reason: 'parse' })
  })

  it('省略协议时补 https', () => {
    expect(normalizeWebUrl('example.com')).toEqual({
      ok: true,
      url: 'https://example.com/',
      host: 'example.com',
    })
    // host:port 里的冒号不是协议，不能被当成协议
    expect(normalizeWebUrl('localhost:3000')).toEqual({
      ok: true,
      url: 'https://localhost:3000/',
      host: 'localhost',
    })
    expect(normalizeWebUrl('127.0.0.1:5173/docs/index.html')).toMatchObject({
      ok: true,
      url: 'https://127.0.0.1:5173/docs/index.html',
    })
  })

  it('保留显式 http（内网/本地站点常见）', () => {
    expect(normalizeWebUrl('http://intranet.local/x')).toMatchObject({
      ok: true,
      url: 'http://intranet.local/x',
      host: 'intranet.local',
    })
  })

  it('剥掉 URL 里的凭证（等于替用户提交一次 basic auth）', () => {
    const r = normalizeWebUrl('https://admin:hunter2@example.com/admin')
    expect(r).toEqual({ ok: true, url: 'https://example.com/admin', host: 'example.com' })
    expect(r.ok && r.url).not.toContain('hunter2')
  })

  it('保留查询与 hash，去掉首尾空白', () => {
    expect(normalizeWebUrl('  https://example.com/s?q=a%20b#c  ')).toMatchObject({
      ok: true,
      url: 'https://example.com/s?q=a%20b#c',
    })
  })

  it('host 取 hostname（不含端口），供 id 与关键词使用', () => {
    expect(normalizeWebUrl('https://example.com:8443/x')).toMatchObject({
      ok: true,
      host: 'example.com',
    })
  })

  it('punycode / 中文域名可解析并给出 host', () => {
    const r = normalizeWebUrl('https://xn--fsq.com/')
    expect(r).toMatchObject({ ok: true, host: 'xn--fsq.com' })
  })
})
