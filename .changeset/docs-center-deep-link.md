---
'webos': minor
---

文档中心从「类目契约的示例」做成「真能查文档的应用」。上一轮（D2′）它只证明了 embed 类目渲染得出来，本轮把它身上四处实测出来的坏补掉，并把被门禁放过一次的口径失真一并修正。

- **深链不再套壳**：`vite.config.ts` 加内联插件 `serve-embedded-docs`，对 `/docs/` 前缀依次试 `<path>.html`、`<path>/index.html`，**命中真实文件才重写 `req.url`** 再交回 Vite 的静态服务（响应头与缓存不改），dev 查 `public/docs`、`configurePreviewServer` 查 `dist/docs`。此前 `/docs/`、`/docs/components/`、`/docs/tokens` 这类目录根与无扩展名深链在 dev/preview 两侧**全部**落回 WebOS 自己的壳 HTML：Vite 服务 `public/`/`dist/` 的 sirv 配了 `extensions: []`，`htmlFallbackMiddleware` 又只看项目根，而文档站开着 `cleanUrls`、站内链接本来就全是这两种形态（改 `cleanUrls: false` 也救不了 logo 的 `normalizeLink('/')` 与带尾斜杠的 nav）。同源入口的口径因此在文档里从「必须带扩展名」放宽为**三层各管一段**。
- **首开即有内容**：`predev` 挂 `node scripts/embed-docs.mjs --if-missing`（已有产物就跳过，缺时才实跑，约 1.5s），Playwright 的 webServer 走同一条 `npm run dev`，于是没挂 `pretest:e2e` 的 `test:e2e:a11y` / `test:e2e:visual` 两个 job 也一并自愈——npm 的 `pre<script>` 只对同名 script 生效，这是它们此前撞上「iframe 里只有一行裸文本」的原因。
- **文档站会「查文档」**：开 `themeConfig.search = { provider: 'local' }` 并配 `options.translations`（VitePress 不自带搜索，而默认件文案是英文，中文站只开 provider 会显示 "Search"）；激活根级 `lastUpdated`（只配 `themeConfig.lastUpdated` 是改文案不是启功能）；补 `/tokens` 与 `/architecture` 的参考侧栏。搜索索引与 `minisearch`/`mark.js`/`focus-trap` 全是 VitePress 自带依赖、只落 `dist/docs`（实测新增 2 个懒加载 chunk ≈201KB），OS 首屏 243.5KB 与单块预算都不受影响。⌘K 与 `/` 的归属同时写进指南：焦点进了 frame 之后开的是文档站内搜索，**不**由父层接管 frame 快捷键——那等于给 embed 类目开同源专属特权，违反「chrome 对类目一无所知」。
- **口径与命名**：`website/index.md` 与 `website/architecture.md` 的组件数 18 → 41（`src/ui/Os*.vue` 实测；《WebOS对标AntDesign迭代规划》§3 的 18 与 31 是规划时点快照，不回改，只在注尾加指针）；`en-US` 的 `apps.docEditor` 由 `'Docs'` 改为 `'Doc Editor'`，让位给无宾语的「文档」`docsCenter`——英文界面上两个应用同名是用户能直接看到的错。
- **门禁**：`tests/e2e/docs-deep-link.spec.ts` 6 条（首开 `.VPHome` 在场 + 内链三形态盘点 + 搜索触发件装配 + 三条硬导航各锁 `html[data-webos-guard]` 计数 0），`tests/unit/i18n.test.ts` 新增「同一语言内 `apps.*` 取值不得重复」——key 齐平门禁管「有没有」，管不到撞名这一类。反证三跑三红：摘中间件 → 三条硬导航红；摘 `search.provider` → 触发件断言红；把 `docEditor` 改回 `'Docs'` → 撞名用例红并报出两个 key。
