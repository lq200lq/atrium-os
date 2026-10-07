# Atrium OS 小组件开发指南

> 面向对象：要在这套 Atrium OS 桌面上挂一个**小组件**（widget）的开发者。
> 目标：新增一个小组件**只动一个目录**（`src/widgets/<id>/`），不改壳层、不改 `main.ts`。
> 与「应用」的区别：应用开**窗口**（进 Dock / 应用中心 / Spotlight），小组件是**桌面件**——贴在壁纸层、在窗口之下、不进窗口体系。
> 本指南只讲**怎么写**（契约与约束）；这条功能线**要做到什么程度**（现状诊断、内容规格、分期与验收）在《AtriumOS小组件功能设计.md》，其中 §4.0 是 Apple HIG 小组件规范的逐条对照。
> 2026-10-07 按「小组件功能线」实现结果整体回写：实现与设计口径的 9 条偏差逐条写在功能设计 §8「实现偏差」，本指南以代码为准。

## 1. 30 秒上手

```bash
npm run gen:widget -- world-clock --name "世界时钟" --icon clock --sizes sm,md --default-size md --order 60
```

生成器产出 `src/widgets/world-clock/{manifest.ts,App.vue}`。重启 `npm run dev` 后：

- 桌面右键 →「添加小组件」→ 在小组件库的「小组件」段里选中它、选尺寸 → 添加；
- 删除该目录，小组件从库里消失（已放到桌面的实例也一并无从渲染）。

不带参数运行 `npm run gen:widget` 进入交互式问答。

> **生成器现状（2026-10-07 实测，2026-10-06 复核并更新）**：`gen-widget` 已是「半可直接上线」——交互问答收 id/名称/图标/tint/档位/下钻目标/单例/双语描述，产出 `manifest.ts`（带 `nameKey`/`descriptionKey`/`config` 空数组/准入四格注释模板）与 `preview.json` 样例桩，**同步写两份语言包**的 `widgets.names.*`/`widgets.descriptions.*` 叶子，最后直接跑 `check-widget-contract`（T5/T9/T12）让门禁当场报缺口。原残留①（产出的 `App.vue` 是调试骨架，带 `text-micro` 与裸 `opacity-*`）**已消**——骨架换成合规写法：前景走三档 `text-widget-ink*`、文字不低于 `text-caption`、内衬归宿主、不再 `JSON.stringify(config)`，且当场会踩 `check:tokens` 的 `widget-foreground` 作用域规则自证合规。剩一处：`description`/`keywords` 没给答案时出 TODO 占位注释，判据 K1「完全落地」前照本指南 §3~§6 手工填。

## 2. 小组件是如何被自动收集的

`main.ts` 用 Vite 的 `import.meta.glob` 扫描并注册，与应用同一条约定（第三条 glob）：

```ts
const widgetModules = import.meta.glob<{ manifest: WidgetManifest }>('./widgets/*/manifest.ts', {
  eager: true,
})
for (const mod of Object.values(widgetModules)) widgetRegistry.register(mod.manifest)
```

- **约定优于配置**：文件落在 `src/widgets/<id>/manifest.ts` 且导出 `manifest`，就会被收进注册表。
- **排序由 `manifest.order` 决定**（缺省 100），与 glob 收集顺序无关——`register()` 内部按 order 升序稳定插入。
- 组件经 `defineAsyncComponent(manifest.entry)` 懒加载，首屏不加载没上桌面的小组件（这一格 2026-10-06 起由 `check-bundle` 的 T8 静态图腿判，见 §11）。
- **kind 全是构建期声明**：运行期只新增/删除**实例**，不会动态注册 kind。因此 kind 注册是同步的，早于任何 `restore()`。

## 3. `WidgetManifest` 字段表

契约定义在 `src/kernel/stores/widgetRegistry.ts`，以下逐条与该文件核对（2026-10-07）。

| 字段             | 类型                                                     | 必填 | 说明                                                                                                                                                                                         |
| ---------------- | -------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | `string`                                                 | 是   | 全局唯一，kebab-case；同时是目录名与实例 id 前缀（`wgt-<id>`）。**一经发布就是数据键，不得重命名**（见 §10）                                                                                 |
| `name`           | `string`                                                 | 是   | 小组件库里的显示名                                                                                                                                                                           |
| `nameKey`        | `string`                                                 | 否   | i18n 文案 key，缺省回退 `name`                                                                                                                                                               |
| `descriptionKey` | `string`                                                 | 否   | 目录行一句话描述（B5）。写法有规矩：动词开头、禁自指，见 §12                                                                                                                                 |
| `description`    | `string`                                                 | 否   | 描述兜底（`descriptionKey` 缺失时）                                                                                                                                                          |
| `icon`           | `IconName`                                               | 是   | 取值见 `src/kernel/icons.ts`（lucide 子集，白名单由 `npm run icons:gen` 维护）                                                                                                               |
| `tint`           | `string`                                                 | 否   | 小组件库磁贴与「添加」钮的渐变类，白前景对**每个**渐变端点 ≥4.5:1（`tile-contrast` 门禁逐行量 Dock/应用中心/小组件库三处）；浅色相（amber/sky/emerald）600 档不够、要从 700 档起；缺省中性灰 |
| `entry`          | `() => Promise<Component>`                               | 是   | 组件入口，固定写 `() => import('./App.vue')`                                                                                                                                                 |
| `widget`         | `{ sizes: WidgetSize[]; defaultSize?: WidgetSize }`      | 是   | 支持的尺寸档（`sm`/`md`/`lg`）与初始档；`defaultSize` 缺省取 `sizes[0]`。**卡片菜单档位组、键盘 `⌥←/⌥→` 与库内选档都只提供这些档**（S-1）                                                    |
| `padding`        | `'default' \| 'compact'`                                 | 否   | 卡片内边距档：default=16、compact=11（`--spacing-widget` / `--spacing-widget-compact`）。缺省 `default`；件侧不可再自定间距（G-2）                                                           |
| `refresh`        | `'live' \| 'minute' \| 'hour' \| 'day' \| 'manual'`      | 否   | 取数节奏档；宿主据此挂共享 tick、给卡片菜单「立即刷新」、暴露 `useWidgetStatus().lastRefreshAt`。无数据源的件不声明                                                                          |
| `data`           | `{ key: string; scope: 'shared' \| 'instance' }`         | 否   | 自有数据声明：shared → `/我的数据/<key>.json`，instance → `/我的数据/<kindId>/<instanceId>.json`；供预览沙箱喂样例与「孤儿数据」盘点                                                         |
| `singleton`      | `boolean`                                                | 否   | `true` 时桌面最多一个实例，重复添加复用既有实例；缺省 `false`（多实例）                                                                                                                      |
| `config`         | `WidgetConfigField[]`                                    | 否   | 每实例配置 schema（**恒 ≤3 项**，见 §12）；每类字段形态见 §6                                                                                                                                 |
| `configEntry`    | `() => Promise<Component>`                               | 否   | 件自绘配置面板（§6 / 功能设计 §4.12）：只换表达，schema 仍必填、提交仍过 `sanitizeConfig`                                                                                                    |
| `openAppId`      | `string \| { appId: string; payloadFor?(ctx): unknown }` | 否   | 下钻落点。`ctx` 给 `{ size, config, selected }`（`WidgetDrillContext`）；内置件**必答题**：给落点或写明豁免理由                                                                              |
| `interactive`    | `boolean`                                                | 否   | §4.5 三类件的**显式判别位**：`true` = 交互/混合型，平台**不接管**整块点击（下钻走卡片菜单 / Enter / 件自己的标题行）；缺省 `false` = 展示型，声明 `openAppId` 即整块可点                     |
| `seed`           | `boolean`                                                | 否   | 首次运行（从未落库过实例）时是否默认铺到桌面；用户清空后不再补种                                                                                                                             |
| `keywords`       | `string[]`                                               | 否   | 搜索关键词。管理面搜索框消费 `keywords` + 名称 + 描述（2026-10-07 接线）；`gen-widget` 只放 id 占位，中英搜索词要 author 补                                                                  |
| `version`        | `string`                                                 | 否   | 语义化版本                                                                                                                                                                                   |
| `permissions`    | `string[]`                                               | 否   | 访问所需权限点；为空/缺省表示公开。判定与内置应用共用 `session.canAccess()`                                                                                                                  |
| `order`          | `number`                                                 | 否   | 小组件库排序权重，越小越靠前，缺省 100                                                                                                                                                       |

> 新增字段一律**可选**，以免破坏既有小组件。
> 注册表还派生两个入口：`accessibleWidgets`（当前会话可访问，目录段的正数据源）与 `inaccessibleWidgets`（无权限的 kind——目录灰态行「需要 <角色>」的数据源，2026-10-07 已接线；灰态只告知，桌面渲染口径不变）。

## 4. 渲染契约：`useWidgetContext()`

小组件组件是 **prop-less** 的：宿主不传任何 props，组件自己 inject 上下文（与窗口里的 `useWindowContext()` 同构）。
全链路只有**一个注入键** `WIDGET_CONTEXT_KEY`（`src/kernel/composables/useWidgetContext.ts`）；容器侧的 `createWidgetContext` / `provideWidgetContext` / `createPreviewWidgetContext` 归宿主与预览沙箱用，**件内只认 `useWidgetContext()` 一个入口**——包括预览沙箱，它也从不往实例表塞假数据，而是 provide 一份 mock 上下文（这是实现相对设计稿的一处强化，见功能设计 §8「实现偏差」第 5 条）。

```ts
import { useWidgetContext } from '@/kernel/composables/useWidgetContext'

const { instanceId, size, config, padding, selected, setSelected, preview, visible } =
  useWidgetContext()
```

| 返回值        | 类型                                    | 说明                                                                                              |
| ------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `instanceId`  | `string`                                | 当前实例 id（同一 kind 可多实例，用它区分；预览沙箱里是 `preview:<kindId>`）                      |
| `kindId`      | `ComputedRef<string>`                   | 自己的 kind id：**实例被摘掉后仍可读**，取数键与命名都靠它，别去 `instance?.kindId` 多绕一层判空  |
| `instance`    | `ComputedRef<WidgetInstance \| null>`   | 实例记录（size / pos / config / addedAt）；**可空**——确认移除后件还有一帧在跑，那时记录已不在表里 |
| `manifest`    | `ComputedRef<RegisteredWidget \| null>` | 自己的 manifest（注册表原物，含宿主用的异步组件，件侧只读契约字段）；同样**可空**                 |
| `config`      | `ComputedRef<WidgetConfigValues>`       | 已按 schema 收敛过的配置（键必属于 `manifest.config`）                                            |
| `size`        | `ComputedRef<'sm' \| 'md' \| 'lg'>`     | 当前尺寸档                                                                                        |
| `padding`     | `ComputedRef<'default' \| 'compact'>`   | 卡片内边距档（H-7），材质仍归宿主                                                                 |
| `selected`    | `ComputedRef<unknown>`                  | 件内当前选中项（月历的日期、待办的筛选），宿主据此构造下钻 payload                                |
| `setSelected` | `(value: unknown) => void`              | 写入选中项（只活在本次会话，不落库；预览沙箱里是空操作）                                          |
| `preview`     | `boolean`                               | 当前是否在预览沙箱里渲染（样例数据兜底、`titleKey` 解析都按它分流）                               |
| `visible`     | `ComputedRef<boolean>`                  | 该实例当前是否真的显示在桌面上                                                                    |

`instance` / `manifest` 的可空不是防御性摆设：件在「已摘掉但仍挂载」的那一帧里读到 `null`，就该安静地把内容收掉，而不是抛错进错误边界（这条是 S14 收尾时的真实崩溃）。取 kind 侧的静态信息一律走 `kindId`，不走 `instance`。

**尺寸档直接用 `size` 分支，不用容器查询反推**——它是宿主已知的离散值。

### 4.1 卡片材质与表面 token（件内不碰颜色）

**卡片材质不用自己写**：底、圆角、边框、阴影、模糊、前景色、尺寸位、错误/加载兜底都由 `WidgetFrame` 提供；**卡片表面不放任何宿主自绘浮标**——「移除」与换尺寸都从卡片右键菜单走（键盘另有 `Delete` / `⌥←/⌥→`）。曾有的右上角「×」与右下角拖角手柄已于 2026-10-07 摘除，判据见功能设计 §4.4 R4 与 §8 偏差 29。材质类串是 `src/kernel/widget/material.ts` 的 `WIDGET_CARD_CLASS` 一处（桌面卡片与预览沙箱共用），内边距档由 `widgetPaddingClass(padding)` 给（`p-widget` / `p-widget-compact`）；这条类串**不在组件里、也不在 `src/ui`**。

卡片前景与表面**同层派生**（`--color-widget-*`，明暗两档，`backdrop-blur` 只负责质感不负责可读性）：

| Token                         | 用途                                       |
| ----------------------------- | ------------------------------------------ |
| `--color-widget-surface`      | 卡片底（自带可读底，不外包给壁纸）         |
| `--color-widget-ink`          | 主前景（`text-widget-ink`）                |
| `--color-widget-ink-mute`     | 次级前景（不透明灰度值，替代裸 `opacity`） |
| `--color-widget-ink-disabled` | 禁用/完成态前景                            |
| `--color-widget-line`         | 件内分隔线、吸附 ghost 描边                |
| `--color-widget-fill`         | 件内浅底（chip、进度槽、hover 底）         |
| `--color-widget-border`       | 卡片描边（宿主消费）                       |

组件内的三条同源约束：

- 禁止 `text-white`、禁止对前景用裸 `opacity-*`（三级前景用上面三档**不透明** token）；
- **文字地板**：件内**文字**一律 ≥11px——`text-micro`（10px）在 `src/widgets/` 下禁用；符号（`OsIcon :size`）与图形渲染尺寸不受限；
- **件内圆角不得与卡片 `rounded-dock` 同值**（H-11）：图片/缩略图/底槽用低一档的 `rounded-chip` / `rounded-surface`，避免「双圈」。

前两条的一半已进门禁（`check:tokens` 的 `widget-foreground` 作用域规则，详见 §10 第 9/11 条）：作用域外的 `text-micro` 仍合法，且对前景裸 `opacity-*` 依然走人审。

另两条边界（HIG A-13 的落地护栏）：**预览沙箱必须 `pointer-events:none` + `aria-hidden` + 标「预览」**（`WidgetPreview.vue` 已按此实现）；**应用内不得复用件卡片样式**——件与应用是两个 UI，不是同一套皮肤。

### 4.2 数据契约：`useWidgetData()`（自有数据的唯一正道）

件的业务数据一律走 VFS（`/我的数据/…`，文件管理里可见、可被别的应用消费、**删件不删数据**），由 `src/kernel/composables/useWidgetData.ts` 提供：

```ts
const { data, write, patch, status, retry } = useWidgetData<TaskFile>(key, factory)
// key/factory 可省——缺省取 manifest.data.key 与 manifest.id；status: 'idle' | 'pending' | 'error'
```

规则：寻址由宿主解出（`widgetDataPath`，件**不得自己拼路径**）；乐观更新 + 失败回滚 + 通知中心集中上报（**不在件内弹错误框**）；落库前 `snapshot()` 剥代理、300ms 防抖合并；首次读给 factory 默认值并落盘；坏 JSON 按未初始化处理而不是炸卡。**预览沙箱内**：`data` 返回件自带样例（`preview.json` 经 `previewSamples.ts` glob，键与 `manifest.data` 对齐），`write/patch/retry` 为 no-op 且 dev 下抛断言，绝不碰真实 VFS。

`scope: 'instance'` 那一份是**该实例私有**的：同一 kind 摆两张卡就各占一个 `<instanceId>.json`，正文互不串台；移除卡片时那个文件**不跟着删**（删件不删数据），它成为孤儿，出口在小组件中心的「数据」段。判据两侧都在——`tests/e2e/widget-acceptance.spec.ts`「§4.2 实例域」两条走真实添加路径证「两张卡各写各的」与「删一张不动另一张、被删那张的文件仍在」（两次正交反证见功能设计 §8 偏差 27），孤儿盘点与清除由 `tests/unit/widget-console.test.ts` 兜。

防抖合并的键是**路径**而不是 handle（功能设计 §8 偏差 16）：同一份 `shared` 数据可以有好几个写者（`todos` 的 md/lg 两张卡各自一个 handle，「今日」应用直接写同一个 `tasks.json`），挂起账本按 VFS 路径共享，`data` 因此总是读到「窗口内所有写合并后的样子」。件侧的正确写法是**以 `data` 为基**再算下一份内容（`write({ items: [...data.value.items, x] })`）；把旧值缓存在自己作用域里覆盖回去，就会把别的写者那一条吃掉。

账本在寻址权威所在处的 `src/kernel/widget/widgetData.ts`（`holdWidgetData` / `releaseWidgetData` / `peekWidgetData` / `readWidgetDataJson`），不属于任何一个调用方——**件外写者也要走这一条边**：读用 `readWidgetDataJson(vfs, path)`（挂起值优先于 VFS），同步写完 VFS 就 `releaseWidgetData(path)`。漏了后半句，卡片下一次 flush 会拿旧底把应用刚写的这条倒回去。判据：`tests/unit/widget-data-debounce.test.ts` 第四条（两条反证各自跑过——读边退回只读 VFS、或写完不作废挂账，用例分别红）。

日期敏感件的样例是**代码生成**的：`kernel/widget/taskSchedule.ts` 的 `sampleTasks()` / `sampleEvents()` 把日期锚在「今天」——静态日期会被「今天」筛选滤空，预览就成了空卡（功能设计 §8「实现偏差」第 4 条）。样例文案走 `widgets.sample.*` 的 i18n key（`titleKey` 只在 `preview` 为真时解析，防手改数据注入任意 key）。

### 4.3 时间与刷新契约：`useWidgetTick()` / `useWidgetStatus()`

- **`useWidgetTick(ms, onTick?)`**：显示层心跳，走 `kernel/widget/scheduler.ts` 的宿主级共享调度器（同一节奏全桌一个定时器、多订阅、`visibilitychange` 整体挂起、回前台补一次、卸载自动退订）。常用档位 `TICK_SECOND`(1s) / `TICK_HALF_MINUTE`(30s) / `TICK_MINUTE`(60s)。**组件内禁止自持 `setInterval`**。预览沙箱内不注册（预览是静态一帧）。
- **`manifest.refresh` 是取数节奏**，与显示层心跳分账（偏差第 9 条）：`WidgetLayer` 按 `REFRESH_PERIOD`（`live`→60s、`minute`→5min、`hour`→1h、`day`→60s 检查间隔、`manual`→不自动）每档挂**一个**共享 tick，到点经 `isDue` 判定后调 `runtime.requestRefresh(id)`；`day` 档用日期串变化判定，回到前台补扫一次。
- **`useWidgetStatus()`**：`{ visible, overflow, disabled, lastRefreshAt, refreshCount, markRefreshed(), onRefresh(handler) }`。件用它决定「被溢出了就别继续拉数据」，并在卡片上显示「更新于 x 分钟前」（A-9）。取数完成记得 `markRefreshed()`。
- **「更新于」走 `useWidgetUpdated()`**（`kernel/composables/useWidgetUpdated.ts`），别在件内自己算：它把 `lastRefreshAt` 经 `relativeTimeLabel()`（`kernel/relativeTime.ts`，`Intl.RelativeTimeFormat`）包成一条 i18n 读数，语言包里只有 `widgets.updated = '更新于 {time}'` 这一层包装语，**不写**「x 分钟前 / x 小时前」这类手写复数叶子。取不到 `lastRefreshAt` 时回落到 setup 时刻，所以预览（不取数）与桌面首帧同构——别把这一行写成「有了 `lastRefreshAt` 才渲染」，那会让两个宿主差一帧（T6）。
  - 适用面：只有**数据源独立于观看者**的件才挂这一行（storage / system / notification-summary / data-summary）。内容即时间的（clock）、变更就是用户自己动作的（calendar / todos / sticky-note / control-center）、每条已带行级时间的（recent-files）都不加——加了就是把同一信息在两处说一遍。机器腿在 `tests/e2e/widget-acceptance.spec.ts` 的 `A9_KINDS`：数据型每件每档**恰一条** `[data-widget-updated]`，其余件**一条都不许有**。
  - 落位：md/lg 的内框 126px 常被 R1 预算排满（`system·md` 实测 used 100%），新增一行会被卡片的 `overflow-hidden` 静默裁掉（T2 的越框腿直接判红）。所以按档选形态：有余量走**尾行**（storage），网格档补**一个同尺寸格子**不加高度（system·md 的第 6 格），排满的单列档走**标题行右端**（notification-summary / data-summary）。

## 5. 尺寸档与桌面排布

网格常量在 `src/kernel/widget/geometry.ts`：`CELL = 68`、`GUTTER = 24`、`MARGIN = 24`、`BAND_COLS = 4`（一个 band = 4 列 = md/lg 的宽度）。

| 档位 | 跨列跨行（`SIZE_SPAN`） | 像素尺寸 | 内容区（default 16） | 内容区（compact 11） |
| ---- | ----------------------- | -------- | -------------------- | -------------------- |
| `sm` | 2 × 2                   | 160×160  | 126×126              | 136×136              |
| `md` | 4 × 2                   | 344×160  | 310×126              | 320×136              |
| `lg` | 4 × 4                   | 344×344  | 310×310              | 320×320              |

**摆放权威在 `WidgetLayer` 一处**：它算网格、跑 `placeWidgets(items, grid)`（纯函数，取代旧 `packRight`），把像素矩形交给 `WidgetFrame`，卡片因此不认识视口也不认识邻居。规则——

- **右锚定自动流式**（缺省态，`pos = null`）：从最右 band 起，band 内自上而下、找第一个整块空位；两个 `sm` 并排铺满一行，`md`/`lg` 独占整行；band 装满向左开新 band。
- **G-1 净间距**：任何两件（含同 band 上下、跨 band 左右）净间距恒＝`GUTTER`（24px），由网格天然保证；间距是平台常量，**件侧不声明、不可配置**，也不要自己算邻居位置。
- **`pos` 是整数网格坐标** `{ col, row }`（L-1）：`col` 从**视口右缘往左数**（col=0 是最右列），行自上而下；跨度仍由 `size` 经 `SIZE_SPAN` 解出，不进 `pos`。
- **整层隐藏条件**不变：放不下一个完整 band（`cols < 4`）时整个小组件层不渲染。
- **溢出有名字、有出口**（E9→§4.7 第 3 步已做）：放不下的实例进 `overflow`（成因 `no-space` / `out-of-range` / `collision`），右下角「+N 个未显示」可展开清单——每行给件名、当前档、成因、三个动作（换小一档 / 移除 / **在管理台定位**：带实例 id 开抽屉，把那一行展开并滚进视线，`openWidgetGallery(entry.id)` → `focusInstanceId`），不做静默裁剪。动线判据在 `tests/e2e/widget-overflow.spec.ts`。

### 5.1 改尺寸（离散档位，S-1~S-6 已落地）

改尺寸**只有离散档、没有连续手势**，两个入口：卡片右键菜单的档位组（多档才出、勾当前档）与键盘 `⌥←/⌥→`（在 `sizes` 数组里前后走）。两者写的都是同一个 `instance.size`，落库即生效并落 IDB（reload 仍在）。**不产生中间态**——档位是从声明里挑一档，不再按像素宽度反查（`nearestSize` 已随拖角一并下线）。放大到被占的格位＝拒绝并保持原档（与拖拽共用同一个占用判定，L-8）；单档件（`sizes.length === 1`）两个入口都不给。拖角手柄与 ghost 预览曾是这条规则的实现（S-2/S-5），2026-10-07 用户裁定「右键菜单已满足，浮标是重复入口」后撤除，ghost 预览现只服务拖拽落点（S-4）。

### 5.2 网格吸附摆放（拖拽，L-1~L-10 已落地）

卡片空白/标题区起手可拖（起点落在件内 `button/input/textarea/select/a/[role=checkbox]/[data-widget-interactive]` 上**不启动拖拽**，L-10；拖拽期间 `setPointerCapture` + 抑制选中与 contextmenu）。落点吸附到整格（`pxToCell`），**必须整块空**，否则拒绝、回弹原位 + 一次短提示（L-3，不做挤压）。`pos=null` 的件被第一次手动操作时，宿主把**全部**实例的当前自动格位一次性固化成 `{col,row}`（L-5 / 台账 C-④，无 IDB 版本变更）。卡片菜单给「退回自动摆放」清 `pos`。视口变窄越界时先向内收，收完仍相交就退回流式重排并在溢出清单给成因（L-7）。**L-7 是两臂，两臂都要有腿**：收得下的那一臂不是"没发生什么"，而是**保留手动态、落在收后的格位，且不得同时进溢出清单**（`tests/unit/widget-placement-rules.test.ts` 的「向内收成功且空位仍整块空」；2026-10-06 核销——这一臂曾挂 `it.skip` 并写着「待 src 修正」，实测 src 本来就对，缺的只是腿，取消 skip 即绿）。列序从右缘数让「贴右的仍贴右」。手动态脱离流式序列：数组下标只管 `pos=null` 的件，`⌘]`/`⌘[` 与排序动作对手动态置灰并提示「已手动摆放」（L-9）。

**摆放域的左界（E18）**：桌面大字标语在**占用 ≥2 个 band** 或**与摆放域外接矩形相交**时淡出——`bandsUsed` 与 `usedRect` 都由 `WidgetLayer` 按摆放结果同源写入（`syncPlacement`），不是组件自己量宽度（偏差第 8 条）；补 `usedRect` 是因为 `≥2 band` 只在宽带下等价于「压进标语区」，`cols < 8` 的窄窗口里单 band 的左缘就已越过标语右缘（偏差第 24 条）；顶栏小字标语常驻。

### 5.3 键盘等价物（手势不是唯一路径）

卡片本体 `tabindex="0"`，聚焦后：

| 键位        | 动作                                     |
| ----------- | ---------------------------------------- |
| `Enter`     | 下钻/打开应用（无下钻目标的件无动作）    |
| `Delete`    | 移除（走确认框）                         |
| `⌥←` / `⌥→` | 在前一/后一**已声明档**间切换（S-6）     |
| `⌘⇧←/→/↑/↓` | 按格挪动（L-6，被拒时同样短提示）        |
| `⌘]` / `⌘[` | 在流式序列里前后移一格（手动态置灰提示） |

### 5.4 桌面速览（E10）

顶栏「显示桌面」按钮（快捷键 `⌘⇧D`）＝ `shellUi.desktopRevealed`：窗口层整体透明化、再点（或点桌面）还原——不改变小组件层的层语义（`z-desktop` 仍在窗口之下）。

## 6. 每个实例的配置（`config` schema + 可自绘面板）

```ts
config: [
  { key: 'hour12', type: 'boolean', labelKey: 'widgets.config.hour12', default: false },
  { key: 'city', type: 'text', labelKey: '…', default: '上海', placeholderKey: '…' },
  {
    key: 'zone',
    type: 'select',
    labelKey: '…',
    default: 'UTC+8',
    options: [
      { value: 'UTC', labelKey: 'widgets.configOptions.tz.utc' },
      { value: 'UTC+8', labelKey: 'widgets.configOptions.tz.utc8' },
    ],
  },
  { key: 'limit', type: 'number', labelKey: '…', default: 5, min: 3, max: 8, step: 1 },
]
```

- 类型只支持 `text | number | boolean | select`。`number` 支持 `min/max/step`（写边界 `clampNumber` 会收敛），`text` 支持 `placeholder/placeholderKey`。
- **select 候选**：`string | { value, labelKey, label?, icon? }`。双语界面下的可读标签**必须走 `labelKey`**；裸字符串只用于「值即可读文本」的极少数场合——裸值要么显示英文原值、要么把中文塞进代码，且**绕过语言包齐平门禁**（E6）。解析走 `kernel/widget/configText.ts`（`fieldLabel`/`optionLabel`：key 优先、原值兜底）。
- **每 kind ≤3 项**（H-9，超出评审否决）；配置是逃生通道不是主路径。
- 实例配置落 IndexedDB（键 `widgets-v1`），**写边界按 schema 收敛**：未声明的键丢弃（`sanitizeConfig`，静默丢弃不是报错）、缺失取 `default`、`select` 取值必须在候选里。`updateConfig` 落库 300ms 防抖（解掉「每击键一次 IDB 写」）。
- 组件里读 `config.value.<key>`；不要假定一定有值——首次添加时就是 schema 的 default 集合。
- 文案：`labelKey` 走语言包（推荐），`label` 直接给字符串（仅当它确实是数据而不是界面 chrome）。
- 可访问名：四类字段控件都由宿主以字段标签作 `aria-label`，件不用管——但**自绘面板（`configEntry`）没有这层兜底，控件名自己负责**。开关最容易漏：`WidgetConfigFields` 把字段标签画成开关的兄弟节点，而 `OsSwitch` 的按钮内容只有一个无文字的旋钮，两者之间没有任何可访问名关系，缺名就是读屏里的一个无名开关。axe 认得这条（`button-name`），可它只在面板真的挂进 DOM 时才看得见，所以判据留了两条腿：`tests/e2e/a11y.spec.ts` 的「小组件卡片配置弹层」场景（2026-10-06 补，补上即报出当时那个无名开关）+ `tests/unit/widget-config-panel.test.ts` 里不依赖桌面种子的四类字段一段。

### 6.1 控件由谁渲染：缺省归宿主，四类形态可自绘（§4.12）

缺省态仍由宿主按 schema 统一渲染（`WidgetConfigFields.vue`：`OsInput` / `OsInputNumber` / `OsSwitch` / `OsSelect`）。**「小组件不写表单」不再是铁律，但 schema 恒必填**——只有当 schema 四类控件表达不了时才声明 `configEntry: () => import('./Config.vue')` 自绘，判据四类形态：① 选项集需要搜索或远大于 6 项（时钟第二时区 19 城）；② 字段联动；③ 需要分组小标题与说明段；④ 需要实时预览。单个开关/数字/下拉一律不值得写面板。`≤3 项` 管的是 **schema 项数**，自绘面板不是绕过它的后门。

面板组件同样 prop-less，走 `useWidgetConfigPanel()` 取通道（`src/kernel/composables/useWidgetConfigPanel.ts`）：

```
{ instanceId, kindId, schema, values /* 草稿 */, dirty, status, patch(partial), setValue(key, value), commit(), reset(), close() }
```

四条硬规矩：`patch` 只改**草稿**、`commit`/`close`（脏则提交）才落库；提交仍过 `sanitizeConfig`（塞 schema 外的键被静默丢弃）；面板**不得出现平台动作**（不能放「移除件 / 换尺寸 / 停用 / 打开应用」——那些归卡片菜单与管理面）；面板**不得自绘材质**（容器/焦点/Esc 归宿主弹层，面板内只允许 `src/ui` 控件 + token 派生类，且禁 import `@/kernel/stores/*`）。面板必须能在 mock context 下渲染（预览沙箱同构断言覆盖 `configEntry`）。

## 7. 点击、交互与下钻

件分三类（功能设计 §4.5）。实现用一个**显式契约字段** `interactive?: boolean` 判别，而不是靠约定推断（这是相对设计稿的偏差第 1 条，设计稿的「三类件」在代码里就是这三行）：

| 类型   | 声明方式                           | 平台行为                                                      | 内置件例                                                                       |
| ------ | ---------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 展示型 | 未声明 `interactive` + `openAppId` | 整块可点、光标 `pointer`，点击即下钻（带 payload 落具体内容） | `storage`、`recent-files`、`data-summary`                                      |
| 交互型 | `interactive: true`                | 平台不接管点击；下钻走卡片菜单 / `Enter` / 件自己的标题行入口 | `todos`、`calendar`、`sticky-note`                                             |
| 混合型 | 交互 + 有主下钻目标                | 同交互型，另在卡片菜单给「打开应用」                          | `calendar`（点日期）、`control-center`（空白处整块进设置、卡内 chip 自持切换） |

- **下钻带 payload**：`openAppId: { appId, payloadFor(ctx) }`，`ctx = { size, config, selected }`。件把「卡片上那条内容」写进 `setSelected(...)`，落地页就是那条内容对应的详情位置（U7）——「只填 appId 落首页」对内置件判不合格（`WidgetFrame` 的整块点击、菜单项与件内 `useWidgetDrill()` 消费的是同一份解析结果，不会给出两种落点）。
- **下钻可达性**：`openAppId` 指向的应用若当前会话 `canAccess` 不过，整块点击与菜单项**一起自动消失**。
- **豁免要写明**：内容本身就是答案的件（时钟、便签 lg 就地编辑、系统状态）可不给下钻，但豁免理由要写在 manifest/评审里；「落到应用首页」不算下钻。
- **动作反馈分级**：勾选/切换这类可逆动作**不弹确认**；删除条目与「移除件」弹一次确认；失败走通知中心（`useWidgetData` 已按此实现）。
- 内置件现状（2026-10-07 核对）：月历**已能翻月**（‹ ›，`Home` 回今天以选中态回退到当天实现为点标题行）；待办勾选/新增/删除经 `useWidgetData` 落 `/我的数据/tasks.json`，刷新后仍在，与「今日」应用共享同一份文件（互不 import，只共享 `taskSchedule.ts` 数据契约）。

## 8. 管理面（用户怎么增删、摆放与配置）

管理面的一份实例面板实现是 `src/components/WidgetConsole.vue`，两个入口共用：

| 入口               | 打开方式                                      | 定位                     |
| ------------------ | --------------------------------------------- | ------------------------ |
| 小组件库（抽屉）   | 桌面空白处右键 →「添加小组件」；溢出角标的 +N | 桌面侧快改（420px 抽屉） |
| 小组件中心（应用） | Dock / 应用中心 / Spotlight /「管理小组件…」  | 种类台账（普通窗口）     |

面板是 §4.8 的**合一视图**，四段（2026-10-07 已全部接线）：

- **搜索**：一个输入框，消费 `keywords` + 名称 + 描述（E7 的「字段先立后消费」已闭合）；
- **桌面上的小组件**（`WidgetInstanceRow`）：每实例一行——预览缩略、当前档、换尺寸（分段控件与卡片菜单档位组写同一个 `instance.size`，两个入口一个权威）、「配置」就地展开 `WidgetConfigPanel`、上移/下移排序把手（顺序权威是数组下标；**手动态实例置灰**，L-9）、「⋯」收进立即刷新/打开应用/退回自动摆放/移除；没显示在桌面的实例在这里标出**成因**（`no-space`/`out-of-range`/`collision`，与层角溢出清单同一份运行态）；
- **小组件**（`WidgetCatalogRow`）：每种一行——预览缩略（最小档）+ 一行描述 + 支持档位 + `tint` 着色的「添加」钮（多档时弹出选尺寸再确认，A-4：尺寸不是另一种件）；启用/停用与安装/卸载收进「⋯」，卸载因连带摘实例要走确认；**无权限的种类不再从货架静默消失**——灰态行告知「需要 <角色>」（按权限反查角色名，不印权限 id），桌面渲染口径不变；
- **数据**：盘点 VFS `/我的数据` 里已无人引用的件数据（孤儿文件），列出路径并可一键清理——「删件不删数据」的另一半：数据永远由用户处置。

预览是**真实渲染**不是截图资产：`WidgetPreview.vue` 挂 mock 上下文（`createPreviewWidgetContext` + 样例载荷），尺寸取 `sizePx(档)` 与桌面同一套几何，容器 `pointer-events:none` + `aria-hidden` + 标「预览」（角标在卡片**上方独立一行**，不在卡片内——多塞一层不属于件的 DOM，两宿主结构比对就成了假分叉）；懒挂载走 `IntersectionObserver` + 全局并发上限（`previewBudget` 的 `MAX_LIVE = 4`，`rootMargin` 120px），滑出视口即还槽——上限是**稳态**上限，不是「前四个永远占位」。
**沙箱屏蔽的是数据与写，不屏蔽浏览器 API 读**：`navigator.storage.estimate`、`navigator.getBattery` 这类异步读在预览态照样发出，宿主不会替你拦。所以件侧要自备两件事之一——要么「拿不到就整项自隐」（§12 降级规则，system 件在非 Chromium 即此），要么在 `preview` 为真时吃件自带的样例读数（`src/widgets/storage/App.vue` 的 `SAMPLE_QUOTA`）。两者都不做，预览就会发出真实 I/O 并与桌面长出不一样的一棵子树（功能设计 §8 偏差 13）。

> **合一视图的「定位」链（2026-10-06 闭合）**：`shellUi.focusInstanceId` 不再是只被消费、无人写入的字段——溢出清单每行的「在管理台定位」调 `openWidgetGallery(entry.id)`，实例行收到 id 后展开配置面板并 `scrollIntoView`。卡片菜单「配置…」仍走宿主弹层、不经抽屉（功能设计 §8 偏差 6），所以它不传 `focusInstanceId`，这不是遗漏。

**卡片菜单**（壳层单例 `shell/ContextMenu.vue` 渲染）条目依序为：尺寸档（多档才给，勾当前档）→ **配置…**（有 `config` 才有；开的是 `WidgetLayer` 里的宿主弹层，`role="dialog"`、Esc/点遮罩关闭，见下）→ 立即刷新（声明了 `refresh` 且非 `manual` 才有）→ 打开应用（下钻可达才有）→ 退回自动摆放（手动态才有）→ 管理小组件…（进小组件中心）→ 移除（danger）。配置弹层没有复用 `OsDialog`——它的「取消/确认」一排与面板页脚的「恢复默认/完成」是同一件事的两份表达（偏差第 6 条）；面板本体 `WidgetConfigPanel.vue`（容器，内部按有无 `configEntry` 切自绘/`WidgetConfigFields` 缺省渲染）是**一份实现两类宿主**：`WidgetLayer` 的弹层与实例行的就地展开——抽屉与小组件中心又共用后者，「弹层/抽屉/中心三处共用」由此成立（§4.12）。

小组件卡片表面不放「移除」浮标：移除从卡片右键菜单或键盘 `Delete` 走，同样弹确认框（右上角「×」与右下角拖角手柄已于 2026-10-07 摘除，见功能设计 §8 偏差 29；判据是 `widget-frame.test.ts`「卡片上没有按钮」那条腿与 T4 的零浮标腿）。单实例（`singleton: true`）已在桌面时，添加按钮显示「已添加」并禁用。

## 9. 种类生命周期：安装 / 启用 / 卸载

kind 全是构建期注册的，但**用装不装、开不开是用户状态**，落 IndexedDB 的第二个键 `widget-kinds-v1`（`{ [kindId]: { installed, enabled } }`，没有记录即缺省 `{ installed: true, enabled: true }`）：

| 动作     | 语义                                                                                       | 落库                             |
| -------- | ------------------------------------------------------------------------------------------ | -------------------------------- |
| **卸载** | 该 kind 的全部实例一并摘掉（同「卸载应用连带关窗」的口径），记为未安装；**可逆**，随时装回 | `widgets-v1` + `widget-kinds-v1` |
| **安装** | 回到货架（缺省态）。实例不复活——空桌面，自己再添加                                         | `widget-kinds-v1`                |
| **停用** | 实例与配置都留着，只是桌面不渲染（停用 ≠ 删除）；台账行标「已禁用」                        | `widget-kinds-v1`                |

派生口径分两层，别混用：`renderable` =「kind 仍注册 + 当前会话可访问 + 未卸载」，`visible` = `renderable` 再叠「已启用」——桌面层（`WidgetLayer`）消费 `visible`，列表类入口消费 `renderable`。**实例粒度启用仍不做**（挂账：现模型 `enabled` 在 kind 上，真要做落点是实例级 `hidden`）。

**写边界多一道**：落库前统一剥掉响应式代理（`snapshot()`）。`Array.prototype.filter` 之类**重建**过的数组元素是响应式代理，IDB 的结构化克隆不认，会抛 `DataCloneError` 并只留一行 warn——这类「写了但没写进去」最难查，所以单测的 IDB mock 照抄结构化克隆（不是 JSON 往返），把这类问题按真库口径暴露出来。

## 10. 禁止事项

1. **禁止跨小组件 / 跨应用 import**：共享能力下沉到 `kernel/` 或 `src/ui/`。
2. **禁止自绘卡片材质**：玻璃底/圆角/阴影一律由 `WidgetFrame`（`WIDGET_CARD_CLASS`）提供；件内圆角不得与 `rounded-dock` 同值。
3. **禁止散落色值与魔法时长**：颜色/阴影/动效只消费 token 派生类（件内前景用 `text-widget-ink*`，动效只消费 `duration-*`）。新增视觉值先进 `src/styles/tokens.css`。
4. **禁止把小组件做成应用或特殊窗口**：小组件不进窗口体系、不进 Dock、不进应用中心；需要窗口就用 `src/apps/`。
5. **禁止在 manifest 外用别的方式注册**：不要改 `main.ts` 或壳层注册逻辑，加目录即可。
6. **禁止在组件里直连别的实例**：实例之间互不可见；要共享状态走 `useOS().on/emit`（CommandBus）或 VFS。
7. **演示数据不要塞进语言包**：语言包只放界面 chrome（控件文案），演示/业务数据属于小组件自己。预览样例文案是唯一例外：走 `widgets.sample.*`，且**只在 `preview` 为真时解析**（防手改数据注入任意 key）。
8. **禁止自持 `setInterval`**：显示层心跳走 `useWidgetTick`，取数节奏走 `manifest.refresh` + 宿主调度器；预览沙箱与页面隐藏时它们替你挂起。
9. **禁止 `text-white` 与对前景裸 `opacity-*`**：三级前景用 `--color-widget-ink` / `-ink-mute` / `-ink-disabled`（不透明灰度值，A-8）。门禁：`check:tokens` 的 `widget-foreground` 规则命中 `src/widgets/` 下的 `text-white`；裸 `opacity-*` 无稳定正则，仍走人审。
10. **禁止在件内弹确认框做可逆动作**：勾选/切换随手可用；删除类才确认；失败走通知中心。
11. **禁止件内文字 <11px**：`text-micro` 在 `src/widgets/` 下禁用（符号与图形不受限）。门禁：同 `widget-foreground` 规则，`src/widgets/` 下的 `text-micro` 直接判红；作用域外（壳层、应用）的 `text-micro` 仍合法。
12. **禁止颜色作为唯一语义通道**：进度环配百分比数字、在线/离线配文字或形状差异、已完成除划线外给勾形（H-3；浅色主题+亮壁纸会夺走颜色，见功能设计 E4）。
13. **禁止在卡片内放 App 图标/品牌标识**：`icon`/`tint` 只属于货架磁贴，用户很少需要靠标志识别内容（A-16）。
14. **禁止重命名已发布的 kind id**：`widgets-v1` 实例与 `widget-kinds-v1` 状态都以 kind id 为键，改名等于让用户桌面上那个件连同数据引用一起消失。要改口径改 `name`/`nameKey`（批次 A 的「今日待办」仍叫 `todos` 就是这个原因）。
15. **禁止件内使用 `<header>` / `<footer>`**：landmark 是页面级的。卡片本身已是 `role="group"` 的 `<section>`，件内再放一个 `<header>` 会被 Chromium 归成 `banner`——实测桌面上 `getByRole('banner')` 从 1 个变成 3 个，「跳转地标」里页面级地标被桌面件压过。件内标题行用 `div` + `text-title`（月历/待办模板里各留了一行注释说明为什么）。门禁：`tests/e2e/widget-baseline.spec.ts` 断言 `getByRole('banner')` 计数为 1，且 `[data-widget-id] header, [data-widget-id] footer` 为 0（出处：功能设计 §8 偏差 11）。
16. **禁止「悬停才显形」的控件只有 hover 一条路**：整块控件的显隐用 `opacity-0 group-hover:opacity-100` 是允许的（第 9 条禁的是拿裸 `opacity-*` 压暗文字前景、代替三档 ink token，那是另一件事），但必须同时挂 `group-focus-within:opacity-100`——否则键盘用户看不见它，而行又必须可 Tab 到。别写 `focus-visible:opacity-100` 来补，按钮自己聚焦已经满足父级 `:focus-within`，那条是重复的（2026-10-06 待办件的删除钮就这么写过；当时 `tests/e2e/focus.spec.ts`「焦点基线规则随样式表发布」按**文档里第一条** `:focus-visible` 规则判，一个工具类变体就能把全站基线顶红，那条判据现已改成选择器精确匹配）。门禁：`tests/e2e/widget-acceptance.spec.ts` T4 的悬停显形一段，量 computed opacity 而非 `toBeVisible()`——Playwright 的可见性只看盒子与 `visibility`，`opacity: 0` 照样判定可见、照样能点，用它测不出「显形」（出处：功能设计 §4.5 末段）。

## 11. 提交前门禁

```bash
npm run type-check        # vue-tsc -b
npm run lint              # eslint
npm run format:check      # prettier
npm run check:tokens      # 无裸色值/裸圆角/裸层级（棘轮基线，新文件默认 0 容忍）
npm run check:widgets     # 契约不空转：T5 下钻给落点或豁免 / T9 描述写法（自指前缀禁词 + 英文句子式大写）/ T12 配置面不越权 / T15 config 字段两侧都在
npm run icons:gen         # 用了新图标必须补齐白名单（gen-icons --check 在 build:check 里兜底）
npm run test:unit         # vitest
npm run test:e2e          # playwright
npm run build:check       # 上面几道的静态部分 + 包体预算（build → check-tokens → check-bundle → icons --check → check-widget-contract）
```

`check-bundle` 除了体积预算还判功能设计 §9 **T8 的「首屏不加载未上桌面件」**：`vite.config.ts` 的 `chunkFileNames` 按 `facadeModuleId` 把件组件块命名成 `assets/widget-<kind>-*.js`（默认名全是 `App-<hash>.js`，十个件不可辨），门禁再从首屏启动块沿**静态** import 边 BFS（`import("./x.js")` 括号隔在中间，不算静态边），两条断言——① 件块不得落在首屏静态图内，② 每个在册 kind 都得有自己的异步块（有人把件改成 `import.meta.glob(..., { eager: true })` 时件代码会并进启动块，①未必看得见，但②一定少一块）。当前读数（2026-10-06，干净构建）：首屏静态图 4 块、件块 11 个（10 个 kind，33.2KB）、落在图内 0 个。

`tint` 那行 Tailwind 原色阶是一处 `palette-class` **棘轮**命中：在册十件的 manifest 各占基线 1，**新文件默认 0 容忍**，所以 `gen-widget` 产出的第一件事就是 `npm run check:tokens` 报红——确认品牌色要留之后跑 `node scripts/check-tokens.mjs --update-baseline` 记进基线（2026-10-06 实测生成器产物：lint / prettier / `check-widget-contract` 当场绿，只有这条棘轮需要 author 处置，生成器收尾已把这条写进 author 清单）。白前景对渐变端点的 ≥4.5:1 地板由 `tests/e2e/tile-contrast.spec.ts` 量，2026-10-06 补了**小组件库抽屉种类行「添加」钮**这一腿（件 tint 是字面量、没有类型兜着，此前只量 Dock 与应用中心）：抽屉腿一跑就查出 `calendar` 4.02、`todos` 3.65 两处，同一轮全量 e2e 另有「今日」磁贴 3.2（Dock 腿早就在判，是这次新增的 tint 漂了）——浅色相在 600 档就是过不了。三处全部收敛到 700 档起：`from-sky-700 to-indigo-800`、`from-emerald-700 to-teal-800`、`from-amber-700 to-orange-800`（便签与「今日」共用这一对，通知摘要本就是）；收敛后十件抽屉实测最低 4.95。

husky pre-commit 会跑 lint-staged（eslint --fix + prettier）与 type-check。生成器产物同样要通过 lint + type-check。文档站另有 `docs:gen` / `docs:check`（API 表与 `src/ui` 源码一致），改过组件 props 就要重跑。

## 12. 内容纪律（该放什么，不是能放什么）

契约字段只保证「能渲染」；半成品感的源头是**没内容预算**。以下四条是评审判据（详规与出处在功能设计 §4.4/§4.9/§4.0 H 组）：

- **R1 每档有内容预算**：manifest 声明的每一个档都要写清「放什么、放几行、放不下怎么办」。没有预算表就不许开那一档。
- **R2 宁缺不夹生**：填不满的档不声明；档位是同一理念随尺寸层层扩展，不是换一套内容。
- **R3 溢出截断 + 计数出口，不滚动**：「还有 N 项」是链接语义，桌面件没有滚动条。
- **R4 密度上界**：每档交互目标上限 `sm` 1 / `md` 2 / `lg` 4；命中区 ≥24×24；行数上限 `sm` 2 / `md` 4 / `lg` 8——超行按 R3 截断而不是缩行高/字号。**计数单位已于 2026-10-06 评审定下**：一个「目标」＝一个**决定**，不是一枚按钮——同一决定的互斥选项（一排 chip、日格单选）合计一个；「一行一个独立决定」的列表型正文（待办每行勾选、最近文件每行打开）与配置面（快捷设置每行一组）**不按个数计，按行数上限封**。所以 `control-center` md 的四排 chip 是四个独立决定还是四个互斥组、`todos` md 的 4 行是否越线，都有确定答案，不再挂「待评审」（原偏差第 3 条已结案，见功能设计 §8）。行数数的是 R1 预算里的**正文行**，宿主标题行与件内「就地新增」行不计入。
- **行高由剩余空间倒推时，上界要按最差形态算术**：`grid-template-rows: repeat(n, minmax(0,1fr))` 把每一格的高度交给「内框 − 其余块」，于是**内容条数一多、或月份行数一到 6，格子就自己缩到地板以下**。这类件（月历 lg 是唯一的）必须先算最差那一屏：内框 320 −（标题 29 + 表头 18 + 根间隙 12 + 议程满 115）= 146px 摊 6 行 ⇒ 每格 21px，撞上 24×24 地板——修法是**让出一行议程**（6 行月只排 2 条，余下走 R3 计数出口），不是给 `minmax` 写死 24px（那会把溢出推进 `overflow-hidden`，见功能设计 §8 偏差 20）。判据落在自动化里：T4 有两条最差形态腿——月历·lg 翻到 6 行的月份量日格、待办·lg 把 `config.limit` 配到 schema 上界 8 量整屏；两条都先断言「这一屏确实是最差形态」（议程含「还有 N 项」、行数确实 6），否则上界没量到而腿自绿。播种条数因此受这条约束：**每个件的种子数据要能填到该档内容预算的上界**。
- **命中区与档位打架时，降级交互而不是降级内容**：小档放不下 24×24 地板，就把那一档做成阅读面（`div`）而不是硬塞按钮，能力留到大档；内容不许缩字号/缩行高来迁就。判据是 T4 的命中区断言**不设豁免表**——地板不达标就说明那一档不该有那个控件。案例：月历 md 的日格实测 42.3×13px，故整月网格在 md 是阅读面，点日期只在 lg（标题行下钻两档都在）。见功能设计 §8 偏差 14。
- **档位是渲染口径，不是建议**（R2 的另一半）：`config` 里的可配字段**不得越过该档内容预算**——小档不因为配置而长出大档那一层。案例：`clock` 在 sm 配 `seconds: true` 仍不画秒（门控是 `size !== 'sm'`），第二时区行只给 lg（`size === 'lg' && secondTz`），md 配上 `secondTz` 也不画。反向同理：缺省值给不出内容时**整层不渲染**，而不是画一行占位（`secondTz: 'local'` → 没有那一行，也不留「白天/夜间」）。作者自查法：把 `config` 的每个门控条件逐个单独拿掉再跑全量，**活下来的那个 mutation 就是你没写的那条腿**——「md 也不画第二时区行」这条就是这么补出来的（先前只 mutate 了别的条件、全量绿，直到把 `size === 'lg' &&` 拿掉仍全不红，才暴露减法判据整类无腿）。腿在 `tests/e2e/widget-acceptance.spec.ts` 的「§4.9 时钟」describe，判据口径见功能设计 §9。
- **新增一个 `config` 字段 = 同时交付三样东西**（schema、件侧读取、一条双臂渲染腿；机器腿是 `check:widgets` 的 **T15**，缺一侧即红，2026-10-06 起）：只在 `manifest.ts` 加字段而件里不读，判「纯摆设」；读了但 `tests/e2e/widget-acceptance.spec.ts` 里没有任何 `config: {K: …}` 出现过，判「缺渲染腿」——**腿按 kind 归账**：必须来自同一个组合对象字面量里的 `kind:'<本件 id>' … config:{ K: … }`，别件的同名键不算（两个件都可能有 `hour12`）。**持久化往返不算渲染腿**——`widget-persistence` 证的是 store 写了读得回，把件里那行 `config.value.K` 删掉它照样绿。双臂的写法：同一次 `mount()` 里两个档各配一个值，一侧证「忽略字段就会多画/少画」、另一侧证「恒取一侧就看不见」，两个方向都能单独变红。**但「双臂」不等于「必须挤在同一次 mount 里」**：`mount()` 用 `wgt-<kind>-<size>` 播种实例 id，**同一次 mount 放不下两张同 kind 同档的卡**——要证「lg 开 / lg 关 / md 越档」三态就得有两张 `calendar·lg`，选择器立刻撞 Playwright strict mode（实测过一次：两张卡共用一个 selector，报 resolved to 2 elements）。正确形状是按档分用例：一条给 `showAgenda=true`（lg 层在屏 + 同屏 md 不越档画），一条给 `showAgenda=false`（lg 整块不渲染且让出的高度被日格吃满）。案例见该文件「§4.4 配置面」describe（`weekStart`/`showAgenda`/`count`/`unit`/`metric`/`showCompleted`/`scope` 九条，`showAgenda` 现占两条）。这三条门控各 mutate 一次的读数是「恒不渲染 / 字段恒真 / 不分档」各红一条，前两条各命中不同用例，第三条与第一条同用例不同臂——**同一对腿能区分这三个方向，才说明双臂是真双臂**。
- **准入四条**（缺一不进内置件清单）：主结论一句话（用户扫一眼拿走什么）、变化来源（它凭什么不是静态贴纸）、下钻落点（或显式豁免理由）、配置 ≤3 项且不改也对多数用户有用。
- **描述写法**（`descriptionKey` 进语言包即受 T9 口径约束）：以操作动词开头（「查看…」「跟踪…」），禁止自指（「此小组件显示…」「使用此小组件来…」「添加此小组件」），句子式大写。
- **降级规则**（系统类件）：任何指标拿不到就整项不渲染，不留 `—`/`NaN`；全部拿不到时件进空态而不是空卡。**空态也要有腿**——它常常不是「清空数据」就能到达的：月历 lg 的「今天没有日程 → 那一行落为农历」按 `todayIso` 过滤议程，测试里必须把事件播种到**别的日子**才做得出这一态（`tests/e2e/widget-acceptance.spec.ts` 的 `mount(page, combos, theme, { eventsOn: 'other' })`，2026-10-06 加的第 4 参）。**某一态在测试里做不出来时，加播种旋钮而不是改默认种子**：那些腿量的就是默认那一屏（死白、字号、命中区），改默认值等于把判据换掉。现在这份 spec 的第 4 参是 `SeedOptions`（`eventsOn`/`recentFiles`/`doneTasks`/`overdueTasks`，全部默认关），`count` 的 8 行上界、`showCompleted=true` 的勾态行、`scope=all` 的逾期项都靠它到达；注意**排布次序也算账**——`sortTasks` 把已完成项排到最后、按 due 升序排，所以标错一条或选远期项就会落在 `slice` 之外，字段失效照样「绿」。
- **单测收尾要掐掉本 store 的落库防抖**（`tests/unit/widget-console.test.ts` 的根级 `afterEach`，2026-10-06 补）：`updateConfig` 排的是 300ms `setTimeout`，而这类文件每个 `beforeEach` 换一个**全新 pinia**——计时器仍挂在上一条用例那个 store 实例上。它在下一条用例中途开火时，Pinia 的 action 包装会顺手 `setActivePinia(自己那个 pinia)`，全局被拨回旧实例；此后组件外那句 `useWidgets()` 取到旧 store，**动作打在新 store、断言读在旧 store**，翻出来的症状是别处的实例出现在这里的断言里（`[ 'wgt-city' ]` 幽灵）。写法就一行：`for (const timer of Object.values(useWidgets().persistTimers)) clearTimeout(timer)`。次级守则：**mount 之后别再环境式取 store**，在用例开头取一次引用用到底。判据用**并发压测红率**，不用「重跑一遍绿」——`for i in $(seq 1 14); do (npx vitest run <该文件> & ) done; wait` 数红条：原状 10 路 8 红、掐了 14 路 0 红；只做微任务排空（`setTimeout(0)`+`nextTick`）仍 12 路 2 红，所以这条 `clearTimeout` 才是药。生产只有一个 pinia，拨回的是同一个实例，故这是**测试地基**问题，不要去改 store。
- **断言「这里什么都没写」必须越过写合并窗口，且比整份快照内容**（T1 反向腿，2026-10-06 修，功能设计 §8 偏差 21）：`useWidgetData` 的落库有 **300ms 防抖**（`DATA_WRITE_DEBOUNCE`），件内动作之后立刻读 IDB，看到的是「还没冲出去」的旧值；再过 50ms 读一次仍然相等——**两次相邻相等把「尚未落盘」与「永不落盘」判成了同一种东西**，这条腿就此自绿。写法：先立一根静默地板 `quietFloorAt = Date.now() + 2 × 300`，用 `expect.poll` 轮询，只有「与上一次读数相同 **且** 已过地板」才通过；比对单位用 `JSON.stringify(kv['fs-v1'])`（**路径名 + 每个节点的内容**），只比路径名集合时「改写了 `events.json` 但没增删文件」这一形照样绿。反证实测：往月历「翻月」里注入一句 `file.write({ events: [] })`，旧判据绿、新判据报 `Error: fs-v1 动了`。同一条腿里的每个动作还要各自断言「这一动真的动了」（点日期要看 `aria-pressed=true`、翻月要看月标题变了），否则两个动作里有一个空跑，反向断言测的是没被碰过的屏。
- **命中区取样：宽或高为 0 不是「不用量」的理由**（T4，2026-10-06 修）：按「`w>0 && h>0`」过滤可交互元素，会把**完全塌陷（高度 0）的元素整个摘出名单**——它恰恰是这条判据最该罚的形态。取样条件改成「仍在文档流里布局」：`el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'`，宽高只作为读数参与 ≥24×24 地板判定。反证用注入法：往月历·lg 塞一个 8×0 的可聚焦按钮，旧过滤 `12 passed`，新过滤按 `calendar 命中区不达标` 点名报红。顺带一条：`offsetWidth/offsetHeight` 读不到 `display: contents` 与 transform 后的真实占据，量命中区一律 `getBoundingClientRect()`。
- **反证要挑「会被告知的观测点」，不是把每个守卫都碰一遍**（T8 预览懒挂载，2026-10-06，功能设计 §8 偏差 22）：这条链上 `syncSlot` 的 `inView.value &&`、`previewBudget` 里的 `w.inView()`、模板的 `v-if="live && kind"` 看着都是门，但把前两处拆成恒真**全量一条都不红**——前者只在 inView 跃迁时被调用（那个 `&&` 走不到被证伪的分支），后者在「所有行都在视口内」的既有测试里与不过滤等价。唯一有信息量的 mutation 是**让观察者说谎**（`IntersectionObserver` 桩的 `isIntersecting` 初值与广播值可控）。据此补的三态腿读数是 `previewSlotState()` 的 `{live,queued}: {0,0} → {3,0} → {0,0}` 同 DOM 棵数 `{0,3,0}`（视口外不申请槽、进视口才挂、滑出立即还槽），helper 是 `tests/unit/widget-console.test.ts` 的 `stubInView(initial)`（返回一个广播函数）。**排查纪律**：mutation 前先问「这个守卫在测试的调用序列里有没有被真正求值」；连续两三个 mutation 全不红，通常意味着缺的是**一整条腿**，不是守卫写错了。另有一条同权的可信度纪律：`node -e` 的额外参数从 `process.argv[1]` 起算，helper 读到 `undefined` 会什么都没改却退出 0——**"mutation 通过"的读数必须先证明 mutation 真的打上了**（本项目用 `/tmp/mut2.cjs`：找不到模式 exit 9；并按 marker 备份原文件，因为本线全部未进版本控制，还原一律比 md5 而不是 `git diff`）。**这条纪律同样管自己**：本轮新加的预览 helper 让 `vitest` 16 条全绿，`vue-tsc -b` 却报 5 处 `'host' is possibly 'null'`——测试 helper 要返回非空类型（`{ host, wrapper }`），别把模块级可空变量直接喂给断言；**补腿后 `type-check` 与 `lint` 一起跑过才算数**。
- **卡片卸载钩子不得清理仍属于实例的平台状态；「跃迁态」要有一条跃迁腿**（§4.10 溢出治理，2026-10-06，功能设计 §8 偏差 23）：`WidgetFrame` 曾在 `onScopeDispose` 里 `runtime.forget(instanceId)`，本意是「卡片没了就收运行态」——但卡片离开 DOM 有两种成因：实例被移除（该清）与**视口变窄把它挤出摆放域**（不该清，那条 `overflow` 记录正是 `+N 个未显示` 清单的数据源）。窄窗那一刻宿主刚 `syncPlacement` 写进 `{visible:false, overflow:'no-space'}`，随后卡片卸载把它删掉 ⇒ 件静默消失、出口不响。修法：`forget` 随**实例**生命周期走（`widgets.remove()` / `uninstall()`）。为什么原先四条溢出用例全绿却漏了它：它们一律用 IndexedDB **静态播种**到「一开机就放不下」，卡片从未上桌面也就从未卸载，`onScopeDispose` 一次都没跑——写这类判据时问一句「这个状态是被跃迁制造的吗」，是的话就得测跃迁（宽→窄→宽），终态播种证不了。
- **按计数写的让位/避让判据，要在最差视口上量一遍几何**（E18 标语让位，2026-10-06，偏差 24）：`bandsUsed ≥ 2` 是「件压进标语区」在宽带下的等价条件，窄带下不成立——`cols < 8` 时只剩一个 band，那条 band 的左缘本身已越过标语右缘，band 数仍是 1。现在判据是 `bandsUsed ≥ 2` **或**与摆放域外接矩形（`widgetRuntime.usedRect`，宿主同源写入）相交；几何权威仍只在 `WidgetLayer`，`Desktop` 只量标语自己那一块的 `getBoundingClientRect()`（换语言/字体到位由 `ResizeObserver` 重测）。两条视口腿各带「前提确实成立」的自证断言，防止判据自绿。
- **浮层可达性判据用 `toBeInViewport({ ratio })`，不是 `toBeVisible()`**（§4.10 溢出清单，2026-10-06，功能设计 §8 偏差 25）：`toBeVisible()` 只回答「渲染了没有」，而 Playwright 的 `click()` 会先把目标**滚进视口**——桌面壳层没有可见的横向滚动条，用户滚不到的位置，自动化却点得动。溢出清单曾把锚点留在出口左缘向右长（宽 448 的面板恒越界约 313px），四个处置动作全在屏幕外，四条老腿却因为「点得动」而全绿。判「看得见且够得着」要逐元素 `toBeInViewport({ ratio: 0.9 })`（默认 `ratio: 0` 等于免检：部分可见就过），再补一次真点击 + 落库读回。写浮层/弹层/菜单类用例时先问这一句：**如果浏览器不肯替用户滚动，这条用例还绿吗？**
- **契约里写「多实例互不共享」，就得有一条同 kind 两张卡的腿；这张卡 `mount()` 不出来，就走真实添加路径**（§4.2 规则 1/5，2026-10-06，功能设计 §8 偏差 27）：`widget-acceptance.spec.ts` 里曾有句注释写着「正文按实例落库，**不与其他实例共享**」，而它所在用例只 `mount()` 了**一张**便签——注释替一条不存在的第二张卡作了保，寻址契约的两侧（**落点形状**与**实例间隔离**）于是只有前一侧有腿。要摆出两张同 kind 同档的卡，不能用 `mount()`：它按 `wgt-<kind>-<size>` 播种实例 id（与上一条 T15 的撞名坑同源），两张会共用同一个 id 并当场撞 Playwright strict mode。正确形状是走真实添加路径——桌面右键 → 添加小组件 → 选 kind → 选档 → 确定，跑两遍，让 store 的 `uniqueId(kindId, …)` 给出两个不同 id（顺带把「id 从哪来」这段也纳入被测系统）。取样按 `data-widget-id` 定位、不按 DOM 序号：reload 后两张的先后不是判据。反证要**两条正交**的，各自只命中一件事：把 `widgetDataPath` 的 instance 分支去掉 `instanceId`（两张卡共写一份）⇒「各写各的」红，而且红在 **DOM 层先串台**（`toHaveValue` 直接读到对家的正文），不必等到读文件；在 `widgets.remove()` 里连带删掉该实例的数据文件 ⇒ 只有「被删那张的文件仍在」红。两个 mutation 命中不同用例，才说明这两条腿守的不是同一件事。可推广的口径：**文档里每一句「已达成的事实」（考卷表、manifest 字段注释、测试注释）都要能指到一条会因它失效而变红的腿**；指不到就改成描述形状或显式标待证，别让它替不存在的场景作保。
- **件内图标只有两种写法能被门禁看见；判"画对了吗"要逐 path 比，不能数 svg**（§4.9 图形通道，2026-10-06，功能设计 §8 偏差 26）：白名单由 `npm run icons:gen` 从源码扫字面量生成，它只认 `<OsIcon name="x">` 与 `icon: 'x'` 两种形状——`icon: ok ? 'wifi' : 'wifi-off'` 这种 ternary 一个名字都扫不到，白名单不补，`IconName`（`keyof typeof ICON_MAP`）当场把编译拦住（好消息：这一关是真的，实测报 `Type '"wifi" | "wifi-off"' is not assignable to …`）。但**运行时它是无声的**：`OsIcon` 写的是 `ICON_MAP[name] ?? ICON_MAP.file`，名字绕过类型时界面画一个 file 图标顶上去，不报错、不缺元素。所以两态字形请写成两态各一条完整字面量（`{ key:'network', icon:'wifi', … }` / `{ …, icon:'wifi-off' }`），别用 ternary。相应地，验收腿判的是「这一格画的到底是不是那个字形」：把 DOM 里 svg 的每条 `path d` 与 lucide 自己的图标定义逐条比（`node_modules/lucide-vue-next/dist/esm/icons/<kebab>.js`，不立像素快照）；只数 svg 个数的腿对上面那条回落完全免检。取期望值时注意这些定义文件被 prettier 折过行——`\bd:\s*"` 能吃全，`\{ d: "` 会整条漏掉长路径（实测 hard-drive 四条只中三条，红得像产品画多了）。
- **视觉基线判红：先分 staleness 与 flakiness，再按区域和 mtime 归因**（T14 视觉腿，2026-10-06）：同一条用例连跑两次比 actual 的 md5——**逐字节相同就是基线过期**（欠一次重生成），不同才是用例不稳（该去钉不确定项，本项目那三处钉子是冻结时钟 / `reducedMotion` / `animations:'disabled'`）。第二步把差异量到区域而不是停在「N% 不同」：`shell-3bands` 与基线只差 **0.23%（2403 像素）**，红点全落在「数据摘要」标题行那几个字与 Dock 带，而卡片网格、band 数、大字标语 `opacity-0` 让位逐像素复现——结构判据没动，欠的是一次重生成，不是回归。第三步按 mtime 与基线生成时刻对表分账：本线 16:17 之后自己动过 `WidgetFrame`/`WidgetLayer`/`apps/today/manifest`/i18n，所以这 0.23% 记在本线头上，别写成「早于本线」。重生成一律在**已提交的干净检出**上跑（`--update-snapshots` 在共享工作区既会被策略挡下，也会把并行会话的时点像素烤进本线基线）。
- **动效**：只允许数据更新的一次性过渡（`duration-quick`/`duration-base`，上限 2s）；件内禁持续动效（呼吸、循环 shimmer、轮播）。骨架的 `animate-pulse` 属加载态例外，预览沙箱不渲染它。

---

## 附：v1 能力边界与现状指针

- **摆放与尺寸**：改尺寸（只给已声明档，入口是卡片菜单档位组与 `⌥←/⌥→`）与网格吸附拖拽**均已实现**（§5.1/§5.2，键盘等价物 §5.3）。卡片表面不放拖角手柄（2026-10-07 撤，见功能设计 §8 偏差 29）。明确不做的仍然是：像素级自由摆放、任意 span、跨 band 拉宽、特大档——见功能设计 §7 与决策 9。
- **`cq-widget` 容器根**：`WidgetFrame` 仍挂着它且**刻意不定义变体**——改尺寸不需要容器查询（落点是离散 `size`，档位由宿主经 context 给出），别误以为换档依赖它；它的保留价值是在刻度层替作者钉住「件按档渲染，不按像素渲染」这句话。去留可单独决定，不阻塞任何功能。
- **仍挂账的开放项**（分期与判据一律看功能设计 §5/§9，本附录只留指针）：实例粒度启用（→ 实例级 `hidden`；原文后面那句「需真实场景」**已于 2026-10-06 作废**——没有任何 kind 声明 `singleton`，同 kind 多实例是用户当下就能走到的路径，数据隔离与删件不删数据也已有腿，见上面的纪律条目与功能设计 §8 偏差 27，剩下的只是产品拍板 `hidden` 的 UI 落点）、`gen-widget` 模板里 `description`/`keywords` 的 TODO 占位注释（`App.vue` 骨架本身已于 2026-10-06 换成合规写法，剩 author 填文案）、`OsButton` danger 对比度（独立工作线）、视觉基线一次性重生成。管理面合一视图（预览挂载/搜索/无权限灰态行/tint/排序把手）**已于 2026-10-07 接线**，不再挂在账上；`focusInstanceId` 的传 id 调用方也已于 2026-10-06 由溢出清单「在管理台定位」补上（§8 原残项框已改写）；T10 去色目视图两条腿（桌面 + 管理面预览）也已在 `tests/e2e/widget-baseline.spec.ts` 落地。
- **右键菜单是壳层玻璃弹层**，不复用窗口内的 `OsMenu`（材质归属不同，见 §8）；因此没有二级子菜单，尺寸档平铺成条目。
