# WebOS 应用开发指南

> 面向对象：要在这套 WebOS 底座上新增一个应用的开发者。
> 目标：新增一个应用**只动一个目录**（`src/apps/<id>/`），不改壳层、不改 `main.ts`。

## 1. 30 秒上手

```bash
npm run gen:app -- hello-world --name "Hello" --icon sparkles --order 50
```

生成器会产出 `src/apps/hello-world/{manifest.ts,App.vue}`。重启 `npm run dev` 后，该应用自动出现在 **Dock / 应用中心 / Spotlight** 三处。删除该目录，三处也自动消失——无需任何注册/注销代码。

不带参数运行 `npm run gen:app` 进入交互式问答。

要把一个**外部网站**挂成应用（不写 Vue 组件），走 `embed` 类目，见 §6。

## 2. 应用是如何被自动收集的

`main.ts` 用 Vite 的 `import.meta.glob` 扫描所有 manifest 并注册：

```ts
const manifestModules = import.meta.glob<{ manifest: AppManifest }>('./apps/*/manifest.ts', {
  eager: true,
})
for (const mod of Object.values(manifestModules)) registry.register(mod.manifest)
```

- **约定优于配置**：只要文件落在 `src/apps/<id>/manifest.ts` 且导出 `manifest`，就会被收进注册表。
- **排序由 `manifest.order` 决定**，与 glob 收集顺序、import 顺序无关（`register` 内部按 order 升序稳定插入，缺省 100）。
- 组件通过 `defineAsyncComponent(manifest.entry)` 懒加载，首屏不加载未打开的应用；声明 `embed` 的应用由 `register()` 换成内置 `EmbedView`，**懒加载与渲染路径不变**（见 §6）。

## 3. `AppManifest` 字段表

| 字段          | 类型                                                            | 必填   | 说明                                                                                                    |
| ------------- | --------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| `id`          | `string`                                                        | 是     | 全局唯一，kebab-case；同时是命令前缀（`<id>:open`）与目录名                                             |
| `name`        | `string`                                                        | 是     | 显示名称（窗口标题、Dock title、应用中心标签）                                                          |
| `icon`        | `IconName`                                                      | 是     | 取值见 `src/kernel/icons.ts` 的 `ICON_MAP`（lucide 子集）                                               |
| `tint`        | `string`                                                        | 否     | 图标底渐变类，如 `from-sky-500 to-blue-600`；缺省为中性灰                                               |
| `entry`       | `() => Promise<Component>`                                      | 二选一 | DOM 应用的懒加载入口，固定写 `() => import('./App.vue')`；与 `embed` 互斥（两者都不给或都给都编译不过） |
| `embed`       | `{ url: string }`                                               | 二选一 | 外部网页应用：内容区由内核的 `EmbedView` 渲染该地址的 iframe，**不需要 App.vue**（见 §6）               |
| `window`      | `{ w, h, minW?, minH? }`                                        | 是     | 初始窗口尺寸与最小尺寸                                                                                  |
| `singleton`   | `boolean`                                                       | 否     | `true` 时同一应用只保留一个窗口，再次打开聚焦既有窗口                                                   |
| `dock`        | `boolean`                                                       | 否     | 缺省 `true`；设 `false` 则不进 Dock（仍可被 Spotlight / exec 打开）                                     |
| `keywords`    | `string[]`                                                      | 否     | Spotlight / 应用中心搜索命中的额外关键词                                                                |
| `version`     | `string`                                                        | 否     | 语义化版本，文档站与 CHANGELOG 消费（S6）                                                               |
| `category`    | `'system' \| 'productivity' \| 'data' \| 'settings' \| 'other'` | 否     | 应用分类，缺省 `other`                                                                                  |
| `permissions` | `string[]`                                                      | 否     | 访问所需权限点集合；为空/缺省表示公开（S2 消费）                                                        |
| `nameKey`     | `string`                                                        | 否     | i18n 文案 key，缺省回退到 `name`（S5 消费）                                                             |
| `order`       | `number`                                                        | 否     | 排序权重，越小越靠前，缺省 `100`                                                                        |

> 新增字段一律**可选**，以免破坏既有应用。

## 4. 窗口与单例语义

- `singleton: true`：`wm.open(id)` 命中既有窗口则复用并聚焦（最小化态自动还原），不再新建。
- `singleton: false`（多实例）：每次 `open` 新建窗口；若 `payload` 带 `key` 字段，则按 `key` 去重复用（如 doc-editor 按文件路径复用）。
- 窗口标题默认取 `manifest.name`；应用内可用 `useWindowContext()` 拿到当前窗口 id，并 `wm.setTitle(id, ...)` 动态改标题。
- 窗口布局（位置/尺寸/层级）由 `windowManager` 持久化到 IndexedDB，刷新后还原。

## 5. `useOS()`：应用唯一的系统入口

```ts
import { useOS } from '@/kernel/composables/useOS'
const os = useOS()

os.open('app-center') // 打开某应用窗口
os.exec('doc-editor:open', { key, path }) // 以命令形式打开（带 payload）
os.on('my:event', handler) // 订阅 CommandBus 事件
os.emit('my:event', payload) // 发布事件
```

- `os.exec('<id>:open', payload)` 是打开应用的标准命令式；未知应用/未注册命令**不抛异常**，返回 `false` 并在通知中心留痕。
- 应用间通信走 **CommandBus**（`os.on` / `os.emit`），不要直接 import 另一个应用的内部模块。
- 文件读写走 **VFS store**（`useVfs()`）；后续（S4）统一经 `DataSource` 契约访问。

## 6. 外部网页应用（`embed` 类目）

把「一个网站」当成应用挂进系统：manifest 不写 `entry`、不建 `App.vue`，只声明地址，内容区由内核统一渲染。

```ts
// src/apps/docs-center/manifest.ts
export const manifest: AppManifest = {
  id: 'docs-center',
  name: '文档中心',
  icon: 'book-open',
  embed: { url: '/docs/index.html' }, // 与 entry 二选一（带扩展名的真文件地址最稳，三层口径见下）
  window: { w: 900, h: 640, minW: 520, minH: 360 },
  singleton: true,
  order: 45,
}
```

- **渲染仍是一条路径**：`appRegistry.register()` 见 `embed` 时合成内置组件 `src/windows/EmbedView.vue`，`WindowFrame`/`windowManager`/壳层不为此类目加任何分支（开闭原则；这是决策 D2′ 的实现形态）。
- **`EmbedView` 在 `src/windows/`，不在 `src/ui/`**：它靠 `useWindowContext()` 反查自己所属窗口的 manifest，属于窗口 chrome 而非可复用 UI 原语，因此刻意不进组件 API 文档表的生成面。
- **用户可在运行期添加**：应用中心「网页应用」分区填 名称 + 地址 即可，记录落 IndexedDB（键 `webapps-v1`，store `src/kernel/stores/webApps.ts`），启动时在 `main.ts` 的第一波 restore 里注册进 registry——**必须早于 `wm.restoreLayout()`**，否则窗口布局恢复时按「appId 不在注册表」被静默丢弃。
- **地址是用户输入，校验在写入边界**：`src/kernel/webapp/url.ts` 的 `normalizeWebUrl()` 用**正向协议白名单**（只放 `http:`/`https:`——注意 `new URL('javascript:alert(1)')` 是能解析成功的，反向黑名单会漏），剥掉 URL 里的用户名/口令，要求 hostname 非空、总长 ≤2048。UI 校验只是体验，store 才是防线。
- **sandbox 的确切取值是有意的**：给 `allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-presentation`，**唯独不给 `allow-top-navigation`**——这是本类目唯一真正的防护（拦住外部页面把整个 WebOS 顶掉）。`allow-scripts` + `allow-same-origin` 只对**同源**文档构成逃逸，而用户填的地址按构造是第三方；本仓唯一的同源嵌入是 E2E fixture `public/embed-demo.html`，它等同于未沙箱，仅限测试用。
- **跨源就是一条硬边界，不假装能翻越**：frame 内文档读不到，因此标题恒为 `manifest.name`、没有前进/后退、没有 URL 回读；暗色主题不会注入 frame。被 X-Frame-Options / CSP `frame-ancestors` 拒绝时 frame 里只剩下一个**父页读不到的空文档**（是 `about:blank` 还是浏览器自己的错误文档，跨源之后无从查证，也不必查证）且**照常触发 `load`**，无法可靠检测，所以 `EmbedView` 只做「8 秒未就绪 → warning + 重试 + 新标签页打开」，而不是谎称识别出了拒绝。实测口径（`https://www.google.com`，响应头 `x-frame-options: SAMEORIGIN`）：frame 拿到 200 并正常触发 `load`，画面是一片空白、界面停在就绪态且不给错误提示——这是**正确的**行为，任何「拒绝检测」都会连带误伤能正常嵌入的站点。限制因此在两处起作用的地方明示：添加/编辑弹窗的说明文案（告诉用户空白时该用什么），以及窗口工具栏常驻的「重试 / 新标签页打开」出口（任何时刻都走得出去）。
- **同源入口有三层，各管一段**（口径已从「必须带扩展名」放宽，别再把它当硬约束）：
  1. **带扩展名的真文件地址**（`/docs/index.html`）最稳——不经任何重写直接命中静态服务，内置样板仍用它；
  2. **目录根与无扩展名深链**（`/docs/`、`/docs/components/`、`/docs/tokens`）由 `vite.config.ts` 的内联插件 `serve-embedded-docs` 接住：只对 `/docs/` 前缀生效，依次试 `<path>.html`、`<path>/index.html`，**命中真实文件才重写 `req.url` 再 `next()`**（静态服务与响应头仍归 Vite），解析后越出 `docsRoot` 一律不重写。dev 查 `public/docs`、`configurePreviewServer` 查 `dist/docs`，同一条规则。
     为什么非中间件不可：Vite 服务 `public/`/`dist/` 的 sirv 配了 `extensions: []`，`htmlFallbackMiddleware` 又只看项目根，所以这两类地址在两侧都永远命中不了真文件；而文档站开了 `cleanUrls`，实测首页内链**全部**是无扩展名或目录根形态（`/docs/`、`/docs/components/`、`/docs/tokens`），改 `cleanUrls: false` 也救不了 logo 的 `normalizeLink('/')` 与带尾斜杠的 nav。
  3. **前两层都没兜住的**（页面真不存在、或指向本站根路径）落 `main.ts` 的反嵌套守卫：`window.self !== window.top` 时壳层不挂载，只给一行可读说明。用户手填一个指向本站的地址也会撞上同一条，这道判断是系统性的，不是给文档应用打的补丁。
     门禁在 `tests/e2e/docs-deep-link.spec.ts`：首页内链形态盘点（三种形态必须都在集合里，新增坏形态会被按模式拦下）+ 三条代表性硬导航 + 守卫态。
- **文档站首开即有内容**：`public/docs` 是生成物且 gitignore，缺它时 iframe 会拿到 SPA fallback 的壳 HTML。`npm run dev` 因此挂了 `predev`（`node scripts/embed-docs.mjs --if-missing`）：已有就跳过，没有先 `vitepress build` 再复制（实测 1.6s）。`playwright.config.ts` 的 webServer 命令也是 `npm run dev …`，于是没挂 `pretest:e2e` 的 `test:e2e:a11y` / `test:e2e:visual` 两个 job 一并自愈——npm 的 `pre<script>` 只对同名 script 生效，这是它们此前拿不到 `public/docs` 的原因。
- **文档站有站内搜索，快捷键归属要写清**：`website/.vitepress/config.ts` 开 `themeConfig.search = { provider: 'local' }`（VitePress 不自带搜索，不配就没有；默认件文案是英文，中文站要连 `options.translations` 一起配，否则触发件与弹窗 placeholder 都显示 "Search"）。热键 `⌘K`/`Ctrl+K` 与 `/` 和 WebOS Spotlight **同名但不冲突**：键盘事件只在获得焦点的那个 document 上派发，不跨 frame 边界。用户可感知的唯一 subtlety 是「焦点进了 frame 之后 ⌘K 开的是文档站内搜索，要用 Spotlight 得先点回壳层」——**别把它当 bug 去父层接管 frame 快捷键**，那等于给 embed 类目开同源专属特权，违反 D2′ 的「chrome 对类目一无所知」。代价核对（实测）：`docs:embed` 1.6s，新增 `@localSearchIndexroot` 与 `VPLocalSearchBox` 两个**懒加载** chunk 共 ≈201KB，全落 `dist/docs`；`scripts/check-bundle.mjs` 只扫 `dist/assets`，OS 首屏预算与单块预算都不受影响。
- **a11y 与视觉门禁的扫描面不含文档站正文**（含它的搜索弹窗）：`tests/e2e/a11y.spec.ts` 刻意不打开文档中心窗口，`visual.spec.ts` 的截图对象也不含它——axe 会下钻同源 iframe，VitePress 自有页面的可访问性问题不该记在壳层门禁头上。
- **固定 `singleton: true`**：同一站点开两个窗口是重复状态，脚手架层不给这个选项；不同的网页应用之间仍各开各的窗。
- 用户添加的应用 `permissions` 为空（公开）：角色模型管的是内置应用的准入，自己添加的应用再给自己设门槛没有意义。名称也不走 `nameKey`——用户输入的名称是数据，本地化它没有意义（`useAppName()` 缺省回退 `name`）。

## 7. 禁止事项

1. **禁止跨应用 import**：`apps/<a>` 不得 import `apps/<b>` 的任何文件。共享能力下沉到 `kernel/` 或 `src/ui/`。
2. **禁止散落色值与魔法时长**：颜色/阴影/动效只消费 token 派生类（`text-ink`、`bg-glass-*`、`duration-base`…）。新增视觉值先进 `src/styles/tokens.css`。例外仅限中性面与 per-app 品牌色。
3. **禁止复制样式**：相似能力收敛到 `src/ui` 基础组件并参数化，不在业务侧抄一份。
4. **禁止直接改壳层注册逻辑**：新增应用只加目录，靠自动收集生效。
5. **禁止在应用里自写 iframe**：外部内容一律走 `AppManifest.embed` + 内置 `EmbedView`，`sandbox`/`allow` 两处收口；业务侧再开一个 frame 就等于把 D2′ 的边界和沙箱策略复制到每个应用里。
6. **禁止与 embed 内容建立消息通道**：本阶段不注册任何 `postMessage` 监听，也不把地址插进 `v-html`/标题模板。开放桥接需要先定协议与来源策略，不是顺手加的一行。

## 8. 提交前门禁

```bash
npm run type-check   # vue-tsc
npm run lint         # eslint
npm run test:unit    # vitest
```

husky pre-commit 会跑 lint-staged（eslint --fix + prettier）与 type-check。生成器产物同样要通过 lint + type-check。
