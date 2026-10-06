/**
 * 反嵌套守卫：同源 embed 入口指向本站自己时，Vite 的 SPA fallback 会把 WebOS 的 index.html
 * 塞回 iframe，于是壳层被自己嵌入。判定与降级页放在**入口模块**（`src/entry.ts`）而不是启动主体里：
 * 被嵌入时整套内核必须一行都不执行——内层与外层共用同一份 IndexedDB，只要跑过 `wm.restoreLayout()`，
 * `windowManager` 的 400ms 防抖持久化就会把内层刚恢复出的旧快照写回 `layout-v1`，
 * 盖掉外层在这期间改动的布局。守卫挡在挂载之前挡不住这件事，只能挡在启动之前。
 */
export type GuardCause = 'docs-fallback' | 'self-embed'

/** 是否被别的文档嵌着。参数化是为了单测能在 happy-dom 里造两种窗口形态。 */
export function isSelfEmbedded(win: Window = window): boolean {
  return win.self !== win.top
}

/**
 * 此刻唯一还能观测到的成因线索就是路径：`/docs/` 前缀说明是文档站深链没被前两层兜住
 * （产物缺了，或那份页面真不存在），处方是跑一条命令；其余落点是「把本站根路径当成了
 * 同源 embed 入口」，处方是改写地址。两种处方混进一句话，就等于把「能修」和「你用错了」
 * 揉在一起，读的人两条都拿不到。
 */
export function selfEmbedCause(pathname: string): GuardCause {
  return pathname.startsWith('/docs/') ? 'docs-fallback' : 'self-embed'
}

interface GuardCopy {
  title: string
  zh: string
  en: string
  link: string
}

const COPY: Record<GuardCause, GuardCopy> = {
  'docs-fallback': {
    title: '文档站内容没备好 · Documentation not ready',
    zh: '这里本该是 WebOS 文档站的一页，但本站现在没有这份页面，Vite 于是把 WebOS 自己的 index.html 返回给了它——被嵌进来的正是这套壳层，所以壳层不在自己里面再挂载一套。跑一次 npm run docs:embed 生成并同步文档站产物即可（npm run dev 首开会自动做这件事）。',
    en: 'This address should serve a page of the WebOS documentation site, but that page does not exist yet, so Vite fell back to WebOS’ own index.html — the shell was embedding itself, so it refuses to mount. Run npm run docs:embed to build and sync the docs (npm run dev does this automatically on first run).',
    link: '打开文档站首页 · Open the docs',
  },
  'self-embed': {
    title: '不能把本站嵌进本站 · This site cannot embed itself',
    zh: '同源 embed 入口要写成一个真实文件的地址（如 /docs/index.html）。指向本站其它路径会被 SPA fallback 回退成 WebOS 自己的 index.html，iframe 里就会出现壳套壳，所以壳层不挂载。',
    en: 'A same-origin embed entry must point at a real file URL (for example /docs/index.html). Any other path on this site falls back to WebOS’ own index.html, which would nest the shell inside itself, so nothing mounts here.',
    link: '打开文档站首页 · Open the docs',
  },
}

/**
 * 渲染降级页。只写 DOM、不启动任何 store：暗色主题拿不到 `theme-v1` 因此这页恒为浅色，
 * 是刻意的——一张说明页不值得为它引入状态依赖（成因判别也不该依赖别的东西）。
 */
export function renderSelfEmbedGuard(doc: Document, cause: GuardCause): void {
  const copy = COPY[cause]
  doc.documentElement.dataset.webosGuard = cause
  doc.title = copy.title

  const root = doc.getElementById('app')
  if (!root) return
  root.replaceChildren()

  const page = doc.createElement('div')
  page.className = 'embed-guard-page'

  const card = doc.createElement('section')
  card.id = 'embed-guard'
  card.className = 'embed-guard'
  card.dataset.webosGuard = cause

  const heading = doc.createElement('h1')
  heading.textContent = cause === 'docs-fallback' ? '文档站内容没备好' : '不能把本站嵌进本站'

  const zh = doc.createElement('p')
  zh.lang = 'zh-CN'
  zh.textContent = copy.zh

  const en = doc.createElement('p')
  en.lang = 'en'
  en.className = 'embed-guard__alt'
  en.textContent = copy.en

  const link = doc.createElement('a')
  link.href = '/docs/index.html'
  link.textContent = copy.link

  card.append(heading, zh, en, link)
  page.append(card)
  root.append(page)
}
