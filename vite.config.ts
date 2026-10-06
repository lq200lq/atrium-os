import { fileURLToPath, URL } from 'node:url'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import type { Connect, Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
)

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

/** 命中真文件才返回重写后的 URL 路径（含原 query），否则 null——不存在的东西不硬造。 */
function remapDocsUrl(rawUrl: string, docsRoot: string): string | null {
  const [rawPath = '', ...queryParts] = rawUrl.split('?')
  const query = queryParts.length ? `?${queryParts.join('?')}` : ''
  let path: string
  try {
    path = decodeURIComponent(rawPath)
  } catch {
    return null // 非法百分号编码：交给 Vite 按原样处理
  }
  const rel = path.slice('/docs'.length)
  const base = resolve(docsRoot, rel.replace(/^\/+/, '') || '.')
  // 解析后必须仍在 docsRoot 内，否则不重写——越界的路径交给 SPA fallback + 反嵌套守卫兜底
  if (base !== docsRoot && !base.startsWith(docsRoot + sep)) return null

  const candidates = rel.endsWith('/')
    ? [[resolve(base, 'index.html'), `${path}index.html`] as const]
    : ([
        [`${base}.html`, `${path}.html`],
        [resolve(base, 'index.html'), `${path}/index.html`],
      ] as const)
  for (const [file, url] of candidates) {
    if (existsSync(file) && statSync(file).isFile()) return url + query
  }
  return null
}

/**
 * 同源嵌入的文档站深链重映射（决策 D2′ 运行链的第一层）。
 *
 * 为什么需要：Vite 服务 public/ 与 dist/ 用的 sirv 配了 `extensions: []`，而 htmlFallbackMiddleware
 * 只看项目根（dev 为 root、preview 为 dist）里有没有 index.html —— 于是 `/docs/`、`/docs/components/`、
 * `/docs/tokens` 这类「目录根 / 无扩展名」地址永远命中不了文档站产物里的真文件，最终被回退成 WebOS
 * 自己的壳。文档站内 logo（`normalizeLink('/')`）与带尾斜杠的 nav 恰好就是这两种形态：会话内 SPA 路由
 * 正常，硬导航（新标签页、地址栏直达、vite preview 下跳页）全落守卫。
 *
 * 只做存在性重写：命中 `<path>.html` 或 `<path>/index.html` 才改写 req.url 然后 next()，
 * 静态服务与响应头仍归 Vite；不命中原样放行，让守卫给出诚实的降级说明。
 */
function serveEmbeddedDocs(): Plugin {
  const middleware =
    (docsRoot: string): Connect.NextHandleFunction =>
    (req, _res, next) => {
      if (req.url?.startsWith('/docs/')) {
        const rewritten = remapDocsUrl(req.url, docsRoot)
        if (rewritten) req.url = rewritten
      }
      next()
    }

  return {
    name: 'serve-embedded-docs',
    configureServer(server) {
      server.middlewares.use(middleware(resolve(projectRoot, 'public', 'docs')))
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(resolve(projectRoot, 'dist', 'docs')))
    },
  }
}

export default defineConfig({
  plugins: [vue(), tailwindcss(), serveEmbeddedDocs()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    rollupOptions: {
      output: {
        // 三类手动分包：vue 全家桶 / 其余 vendor / 壳层。应用经 defineAsyncComponent 动态 import 天然各自成 chunk。
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](@vue|vue|pinia|vue-i18n|@intlify)[\\/]/.test(id)) return 'vue'
          return 'vendor'
        },
      },
    },
  },
})
