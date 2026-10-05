---
'webos': minor
---

外部网页应用成为一类正式应用（架构决策 D2→**D2′**）。原 D2 写的是「窗口内容渲染 = 纯 DOM，不用 iframe」，本条把它收窄为：**壳层与自研应用永远走 DOM**（玻璃材质、统一窗口动画、错误边界、i18n 都依赖同文档渲染），iframe 只允许作为「外部网页应用」的内容区实现，且全仓只有 `src/windows/EmbedView.vue` 一处。

- **契约加宽**：`AppManifest` 的内容来源改成类型层互斥的二选一——DOM 应用给 `entry`，外部网页应用给 `embed: { url }`（都不给或都给都编译不过）。`appRegistry.register()` 在缺 `entry` 时合成内置 `EmbedView`，因此 `WindowFrame`、`windowManager`、`main.ts` 的 glob 自动注册**一行分支都不加**，渲染路径仍是唯一一条。
- **运行期可添加**：应用中心新增「网页应用」分区，填名称与地址即可把一个站点挂成应用，出现在 Dock / 应用中心 / Spotlight，刷新后保持（`webApps` store 落 IndexedDB `webapps-v1`，启动时早于窗口布局恢复注册）。卸载会同时关闭它的活窗口，避免留下无 manifest 的僵尸窗口。
- **内置样板 `docs-center`**：以 `embed: { url: '/docs/' }` 指向本系统文档站；`docs:embed` 把 VitePress 产物同步进 `public/docs/`，dev/preview/构建产物三处同源可达，不引入后端或新依赖。
- **安全边界**：地址在**写入边界**校验（`kernel/webapp/url.ts` 正向协议白名单只放 `http:`/`https:`，剥 URL 凭证、限长 2048——反向黑名单会漏，因为 `new URL('javascript:alert(1)')` 是能解析成功的）；`sandbox` 有意**不给** `allow-top-navigation`，外部页面无法把整个系统顶掉；`src` 只做属性绑定，不进 `v-html`，本阶段不注册任何 `postMessage` 监听。
- **不假装翻越跨源边界**：被 `X-Frame-Options`/CSP `frame-ancestors` 拒绝时浏览器加载的是 `about:blank` 且照常触发 `load`，跨源内容读不到，所以 `EmbedView` 只做「超时 → 警示态 + 重试 + 新标签页打开」并在界面明示限制，同时不提供前进/后退与标题回读。
