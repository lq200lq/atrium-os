import { beforeEach, describe, expect, it } from 'vitest'
import {
  isSelfEmbedded,
  renderSelfEmbedGuard,
  selfEmbedCause,
  type GuardCause,
} from '@/kernel/boot/embedGuard'

// 守卫的两个职责各锁一半：成因判别说清「这次该跑命令还是该改地址」，渲染函数保证降级页
// 真给出那句处方且不留下可挂载的残留。它跑在任何 store 之前，所以这里也不引 pinia。

describe('selfEmbedCause 按路径分成两种成因', () => {
  it('/docs/ 前缀是文档站没兜住', () => {
    for (const path of ['/docs/', '/docs/tokens', '/docs/components/index.html']) {
      expect(selfEmbedCause(path)).toBe('docs-fallback')
    }
  })

  it('其余（本站根路径、别的站点页）是用法错误', () => {
    for (const path of ['/', '/index.html', '/anything']) {
      expect(selfEmbedCause(path)).toBe('self-embed')
    }
  })

  it('前缀按整段匹配，/docsx 不算文档站', () => {
    expect(selfEmbedCause('/docsx/tokens')).toBe('self-embed')
  })
})

describe('isSelfEmbedded 只看顶层窗口', () => {
  const win = (self: number, top: number) => ({ self, top }) as unknown as Window

  it('self !== top 即为被嵌入', () => {
    expect(isSelfEmbedded(win(1, 2))).toBe(true)
    expect(isSelfEmbedded(win(1, 1))).toBe(false)
  })
})

describe('renderSelfEmbedGuard 渲染降级页', () => {
  const causes: GuardCause[] = ['docs-fallback', 'self-embed']

  beforeEach(() => {
    document.documentElement.removeAttribute('data-webos-guard')
    document.body.innerHTML = '<div id="app"><div id="stale-mount-target"></div></div>'
  })

  it.each(causes)('%s：成因写进 html 与卡片，挂载残留被清掉', (cause) => {
    renderSelfEmbedGuard(document, cause)
    expect(document.documentElement.dataset.webosGuard).toBe(cause)
    const card = document.querySelector<HTMLElement>('#embed-guard')
    expect(card?.dataset.webosGuard).toBe(cause)
    // 「被嵌入的那份实例连挂载点都不留」：入口在 store 之前就分叉，这里再锁一次渲染面
    expect(document.getElementById('stale-mount-target')).toBeNull()
    expect(document.querySelector('#app > .embed-guard-page')).not.toBeNull()
  })

  it('两种成因都给可读处方，且各自只给对的那一条', () => {
    renderSelfEmbedGuard(document, 'docs-fallback')
    const fallbackText = document.querySelector('#embed-guard p[lang="zh-CN"]')?.textContent ?? ''
    expect(fallbackText).toContain('npm run docs:embed')

    document.body.innerHTML = '<div id="app"></div>'
    renderSelfEmbedGuard(document, 'self-embed')
    const misuseText = document.querySelector('#embed-guard p[lang="zh-CN"]')?.textContent ?? ''
    expect(misuseText).not.toContain('npm run docs:embed')
    expect(misuseText).toContain('/docs/index.html')
  })

  it('双语并列两个 lang 段落，另给一条仍然走得通的出口', () => {
    renderSelfEmbedGuard(document, 'self-embed')
    const langs = Array.from(
      document.querySelectorAll<HTMLParagraphElement>('#embed-guard p[lang]'),
    ).map((p) => p.lang)
    expect(langs).toEqual(['zh-CN', 'en'])
    const link = document.querySelector<HTMLAnchorElement>('#embed-guard a')
    expect(link?.getAttribute('href')).toBe('/docs/index.html')
    expect(document.title).not.toBe('')
  })
})
