# 小组件开发指南

小组件（widget）是**桌面件**：贴在壁纸层、在窗口之下、不进窗口体系。每个小组件是一个自包含目录 `src/widgets/<id>/`，通过 `WidgetManifest` 契约接入，由 `import.meta.glob` 自动注册——**新增/删除小组件只动一个目录**，不改壳层、不改 `main.ts`。

与[应用开发指南](./app-development)的分工：应用开**窗口**（进 Dock / 应用中心 / Spotlight），小组件**贴在桌面**（由「小组件库」抽屉与「小组件中心」应用增删）。本指南只讲**怎么写**（契约与约束）；这条功能线要做到什么程度（现状诊断、内容规格、分期与验收）见仓库 `docs/WebOS小组件功能设计.md`，本页与仓库 `docs/WebOS小组件开发指南.md` 同源、以代码为准。

## 快速开始

```bash
npm run gen:widget -- world-clock --name "世界时钟" --icon clock --sizes sm,md --default-size md --order 60
```

不带参数进入交互式问答（id/名称/图标/tint/档位/下钻目标/单例/双语描述）。生成器产出 `src/widgets/world-clock/{manifest.ts, App.vue, preview.json}`，同步写两份语言包的 `widgets.names.*` / `widgets.descriptions.*`，最后直接跑契约门禁 `check:widgets` 报缺口。重启 `npm run dev` 后：桌面右键 →「添加小组件」→ 选尺寸放上桌面；删除该目录，件从库里消失。

> 生成器产物有两处残留要手工替换：① `App.vue` 是调试骨架（渲染 `size · config JSON` 一行，用了 `text-micro` 与裸 `opacity-*`，正是下文的禁止事项）；② `description` 出「查看 X 的内容（TODO…）」模板句。

## 自动收集

与 `src/apps/` 同一条 glob 约定（`main.ts` 第三条）：

```ts
const widgetModules = import.meta.glob<{ manifest: WidgetManifest }>('./widgets/*/manifest.ts', {
  eager: true,
})
```

- 文件落在 `src/widgets/<id>/manifest.ts` 且导出 `manifest` 就被收进注册表；排序由 `manifest.order` 决定（稳定插入，与 glob 顺序无关）。
- 组件经 `defineAsyncComponent(manifest.entry)` 懒加载，首屏不加载没上桌面的件（这一格由 `check-bundle` 的 T8 静态图腿判，见下面「提交前门禁」）。
- **kind 全是构建期声明**，运行期只增删实例；kind 注册是同步的，早于任何 `restore()`。

## WidgetManifest 契约

契约定义在 `src/kernel/stores/widgetRegistry.ts`，以下与代码逐字段核对。新增字段一律**可选**，以免破坏既有小组件。

```ts
type WidgetSize = 'sm' | 'md' | 'lg'

interface WidgetManifest {
  id: string // 全局唯一，kebab-case，与目录名一致；一经发布就是数据键，不得重命名
  name: string // 小组件库里的显示名
  nameKey?: string // i18n 文案 key，回退 name
  descriptionKey?: string // 目录行一句话描述，写法见「内容纪律」
  description?: string // descriptionKey 缺失时的兜底
  icon: IconName // src/kernel/icons.ts 白名单（lucide 子集，npm run icons:gen 维护）
  tint?: string // 库内磁贴与「添加」钮的渐变类：白前景对每个渐变端点 ≥4.5:1（tile-contrast 逐行量），浅色相（amber/sky/emerald）从 700 档起；缺省中性灰
  entry: () => Promise<Component> // 固定写 () => import('./App.vue')
  widget: { sizes: WidgetSize[]; defaultSize?: WidgetSize } // 菜单档位组、⌥←/⌥→ 与库内选档只提供这些档
  padding?: 'default' | 'compact' // 卡片内边距 16 / 11（--spacing-widget*）；件侧不可自定
  refresh?: 'live' | 'minute' | 'hour' | 'day' | 'manual' // 取数节奏档，宿主据此挂共享 tick
  data?: { key: string; scope: 'shared' | 'instance' } // 自有数据声明，见下文 VFS 寻址
  singleton?: boolean // true = 桌面最多一个实例（重复添加复用）；缺省多实例
  config?: WidgetConfigField[] // 每实例配置 schema（恒 ≤3 项）
  configEntry?: () => Promise<Component> // 件自绘配置面板（schema 仍必填）
  openAppId?: string | { appId: string; payloadFor?(ctx): unknown } // 下钻落点，内置件必答题或写明豁免理由
  interactive?: boolean // true = 交互/混合型，平台不接管整块点击；缺省 false = 展示型
  seed?: boolean // 首次运行是否默认铺到桌面；用户清空后不再补种
  keywords?: string[] // 管理面搜索消费 keywords + 名称 + 描述
  version?: string
  permissions?: string[] // 空 = 公开；判定与内置应用共用 session.canAccess()
  order?: number // 库内排序权重，越小越靠前，缺省 100
}
```

注册表另派生 `accessibleWidgets`（目录段数据源）与 `inaccessibleWidgets`（无权限 kind 的灰态行「需要 <角色>」）。

## 渲染契约：四个 composable

小组件组件是 **prop-less** 的：宿主不传 props，组件自己 inject 上下文（与 `useWindowContext()` 同构）。件内只认 `useWidgetContext()` 一个注入入口——预览沙箱也从不往实例表塞假数据，而是 provide 一份 mock 上下文。

### useWidgetContext()

```ts
import { useWidgetContext } from '@/kernel/composables/useWidgetContext'

const {
  instanceId,
  kindId,
  instance,
  manifest,
  config,
  size,
  padding,
  selected,
  setSelected,
  preview,
  visible,
} = useWidgetContext()
```

- `instanceId: string`；`kindId: ComputedRef<string>`（实例被摘掉后仍可读）。
- `instance: ComputedRef<WidgetInstance | null>`、`manifest: ComputedRef<RegisteredWidget | null>`——按可空读（确认移除后还有一帧在跑）。
- `config: ComputedRef<WidgetConfigValues>`：已按 schema 收敛过的配置，键必属于 `manifest.config`。
- `size` / `padding`：当前尺寸档与内边距档。**尺寸直接按 `size` 分支，不用容器查询反推**——它是宿主已知的离散值。
- `selected` / `setSelected(value)`：件内当前选中项（月历的日期、待办的筛选），宿主据此构造下钻 payload；只活在本次会话，预览沙箱里是空操作。
- `preview: boolean`（是否在预览沙箱里）；`visible: ComputedRef<boolean>`（是否真的显示在桌面上）。

### 卡片材质与表面 token（件内不碰颜色）

材质**不用自己写**：底、圆角、边框、阴影、模糊、前景色、尺寸位、错误/加载兜底都由 `WidgetFrame` 提供；**卡片表面不放宿主自绘浮标**（移除与换尺寸走卡片右键菜单，「×」与拖角手柄 2026-10-07 已摘，见功能设计 §8 偏差 29）；材质类串是 `src/kernel/widget/material.ts` 的 `WIDGET_CARD_CLASS` 一处（桌面卡片与预览沙箱共用）。件内三条同源约束：

- 禁止 `text-white`、禁止对前景用裸 `opacity-*`——三级前景用不透明 token `--color-widget-ink` / `-ink-mute` / `-ink-disabled`，另有 `--color-widget-surface` / `-line` / `-fill` / `-border`；
- **文字地板**：件内文字一律 ≥11px，`text-micro`（10px）在 `src/widgets/` 下禁用（图标 `OsIcon :size` 与图形不受限）；
- **件内圆角不得与卡片 `rounded-dock` 同值**：图片/底槽用低一档的 `rounded-chip` / `rounded-surface`，避免「双圈」。

头两条的一半是机器判的：`npm run check:tokens` 里有一条 `widget-foreground` **作用域规则**（`rule.scope` 只命中 `src/widgets/`），件内写 `text-white` 或 `text-micro` 直接红；作用域外（壳层、应用）的 `text-micro` 照旧合法。对前景裸 `opacity-*` 没有稳定正则可依，仍走人审。

边界两条：预览沙箱必须 `pointer-events:none` + `aria-hidden` + 标「预览」；**应用内不得复用件卡片样式**——件与应用是两个 UI，不是同一套皮肤。

### useWidgetData()：自有数据的唯一正道

件的业务数据一律走 VFS（`/我的数据/…`，文件管理里可见、可被别的应用消费、**删件不删数据**）：

```ts
const { data, write, patch, status, retry } = useWidgetData<TaskFile>(key?, factory?)
// key/factory 缺省取 manifest.data.key 与 manifest.id；status: 'idle' | 'pending' | 'error'
```

规则：寻址由宿主解出（`widgetDataPath`，件**不得自己拼路径**；shared → `/我的数据/<key>.json`，instance → `/我的数据/<kindId>/<instanceId>.json`）；乐观更新 + 失败回滚 + 通知中心集中上报（**不在件内弹错误框**）；落库前 `snapshot()` 剥代理、300ms 防抖合并；首次读给 factory 默认值并落盘；坏 JSON 按未初始化处理而不是炸卡。**预览沙箱内** `data` 返回件自带样例（`preview.json`，键与 `manifest.data` 对齐），`write/patch/retry` 为 no-op 且 dev 下抛断言。日期敏感件的样例是代码生成的（`kernel/widget/taskSchedule.ts` 的 `sampleTasks()` / `sampleEvents()` 锚在「今天」，静态日期会被筛空成空卡）。

防抖合并的键是**路径**而不是 handle：同一份 shared 数据可以有几个写者（`todos` 的 md/lg 两张卡、「今日」应用直接写同一个 `tasks.json`），挂起账本按 VFS 路径共享（在 `kernel/widget/widgetData.ts`：`hold`/`release`/`peek`/`readWidgetDataJson`），`data` 因此总是读到「窗口内所有写合并后的样子」。件侧以 `data` 为基再算下一份内容，别缓存旧值覆盖回去。件外写者走同一条边：读用 `readWidgetDataJson(vfs, path)`，同步写完 VFS 就 `releaseWidgetData(path)`——不作废，卡片下一次 flush 会拿旧底把应用这条倒回去。

### useWidgetTick() / useWidgetStatus()

```ts
const now = useWidgetTick(TICK_MINUTE, onTick?) // TICK_SECOND 1s / TICK_HALF_MINUTE 30s / TICK_MINUTE 60s
```

显示层心跳走宿主级共享调度器（`kernel/widget/scheduler.ts`：同一节奏全桌一个定时器、`visibilitychange` 整体挂起、回前台补一次、卸载自动退订）。**组件内禁止自持 `setInterval`**；预览沙箱内不注册（预览是静态一帧）。

`manifest.refresh` 是**取数节奏**，与显示层心跳分账：宿主按档（`live`→60s、`minute`→5min、`hour`→1h、`day`→60s 检查间隔看日期变化、`manual`→不自动）每档挂一个共享 tick，到点调 `requestRefresh(id)`。

```ts
const { visible, overflow, disabled, lastRefreshAt, refreshCount, markRefreshed, onRefresh } =
  useWidgetStatus()
```

```ts
const updated = useWidgetUpdated() // ComputedRef<string>：「更新于 3 分钟前」
```

件用它决定「被溢出了就别继续拉数据」；取数完成记得 `markRefreshed()`。

**「上次更新时间」这一行（A-9）不要手写**：走 `useWidgetUpdated()`，它把 `lastRefreshAt` 经 `relativeTimeLabel()`（`kernel/relativeTime.ts`，`Intl.RelativeTimeFormat`）包成语言包里的 `widgets.updated = '更新于 {time}'`。语言包只留这一层包装语，不写「x 分钟前」这类手写复数叶子。拿不到 `lastRefreshAt` 时回落到 setup 时刻——这正是预览与桌面首帧同构的前提：写成「有 `lastRefreshAt` 才渲染」会让两个宿主差一帧。

只有**数据源独立于观看者**的件才挂这一行（storage / system / notification-summary / data-summary）；内容即时间的（clock）、变更就是用户自己动作的（calendar / todos / sticky-note / control-center）、每条已带行级时间的（recent-files）都不加。门禁 `tests/e2e/widget-acceptance.spec.ts` 的 `A9_KINDS` 两头都判：数据型每件每档恰一条 `[data-widget-updated]`，其余件一条都不许有。

落位按档位余量选形态——md/lg 内框 126px 常被内容预算排满（`system·md` 实测 used 100%），新增一行会被卡片 `overflow-hidden` 静默裁掉并由 T2 的越框腿判红：有余量走尾行，网格档补一个同尺寸格子（不加高度），排满的单列档走标题行右端。

## 尺寸档与桌面排布

网格常量在 `src/kernel/widget/geometry.ts`：`CELL = 68`、`GUTTER = 24`、`MARGIN = 24`、`BAND_COLS = 4`（一个 band = 4 列 = md/lg 的宽度）。

| 档位 | 跨列跨行 | 像素尺寸  |
| ---- | -------- | --------- |
| `sm` | 2 × 2    | 160 × 160 |
| `md` | 4 × 2    | 344 × 160 |
| `lg` | 4 × 4    | 344 × 344 |

**摆放权威在 `WidgetLayer` 一处**：跑纯函数 `placeWidgets(items, grid)`，把像素矩形交给 `WidgetFrame`，卡片不认识视口也不认识邻居。规则——

- **右锚定自动流式**（缺省态 `pos = null`）：从最右 band 起自上而下找第一个整块空位；两个 `sm` 并排铺满一行，`md`/`lg` 独占整行；band 装满向左开新 band。
- **净间距恒 = 24px**，由网格天然保证；间距是平台常量，件侧不声明、不可配置，也不要自己算邻居位置。
- `pos` 是整数网格坐标 `{ col, row }`，**col 从视口右缘往左数**（缩窗时贴右的仍贴右）；跨度仍由 `size` 经 `SIZE_SPAN` 解出，不进 `pos`。
- 放不下一个完整 band（`cols < 4`）时整层不渲染；放不下的实例进 `overflow`（成因 `no-space` / `out-of-range` / `collision`），右下角「+N 个未显示」给清单与处置动作，不做静默裁剪。

**改尺寸（离散档位）**：入口只有两个——卡片右键菜单的档位组（多档才出、勾当前档）与键盘 `⌥←/⌥→`；两者写同一个 `instance.size`，落库即生效并落 IDB。**没有连续手势、也不产生中间态**（只从 `sizes` 里挑一档，`nearestSize` 已下线）；放大到被占格位＝拒绝并保持原档；单档件两个入口都不给。拖角手柄与它专属的 ghost 预览已于 2026-10-07 撤除，ghost 现只服务拖拽落点（S-4）。

**网格吸附摆放（拖拽）**：卡片空白/标题区起手可拖（起点落在件内 `button/input/textarea/select/a/[role=checkbox]/[data-widget-interactive]` 上不启动拖拽）；落点吸附到整格（`pxToCell`）且**必须整块空**，否则拒绝、回弹原位 + 短提示（不做挤压）。`pos=null` 的件被第一次手动操作时，宿主把全部实例的当前自动格位一次性固化；卡片菜单给「退回自动摆放」清 `pos`。手动态脱离流式序列：排序动作对它置灰。

**键盘等价物**（卡片 `tabindex="0"`，手势不是唯一路径）：

| 键位        | 动作                                 |
| ----------- | ------------------------------------ |
| `Enter`     | 下钻/打开应用                        |
| `Delete`    | 移除（走确认框）                     |
| `⌥←` / `⌥→` | 在前一/后一已声明档间切换            |
| `⌘⇧←/→/↑/↓` | 按格挪动                             |
| `⌘]` / `⌘[` | 在流式序列里前后移一格（手动态置灰） |
| `⌘⇧D`       | 显示桌面（与顶栏按钮同一个开关）     |

明确不做的：像素级自由摆放、任意 span、跨 band 拉宽、特大档。

## 每实例配置（config schema + 可自绘面板）

```ts
config: [
  { key: 'hour12', type: 'boolean', labelKey: 'widgets.config.hour12', default: false },
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

- 类型只支持 `text | number | boolean | select`；`number` 的 `min/max/step` 在写边界 `clampNumber` 收敛，`text` 支持 `placeholder/placeholderKey`。
- **select 候选**可读标签必须走 `labelKey`（解析在 `kernel/widget/configText.ts`，key 优先、原值兜底）；裸字符串只用于「值即可读文本」的场合，且绕过语言包齐平门禁。
- **每 kind ≤3 项**（超出评审否决）；配置是逃生通道不是主路径。
- 实例配置落 IndexedDB（键 `widgets-v1`），**写边界按 schema 收敛**（`sanitizeConfig`：未声明的键静默丢弃、缺失取 `default`、select 取值必须在候选里）；`updateConfig` 落库 300ms 防抖。
- 组件里读 `config.value.<key>`；首次添加时就是 schema 的 default 集合。

**控件由谁渲染**：缺省由宿主按 schema 统一渲染（`WidgetConfigFields.vue`：`OsInput` / `OsInputNumber` / `OsSwitch` / `OsSelect`）。「小组件不写表单」不再是铁律，但 **schema 恒必填**——只有当四类控件表达不了时才声明 `configEntry` 自绘面板，判据四条：① 选项集需要搜索或远大于 6 项；② 字段联动；③ 需要分组小标题与说明段；④ 需要实时预览。单个开关/数字/下拉一律不值得写面板；`≤3 项` 管的是 schema 项数，自绘面板不是绕过它的后门。

**可访问名**：缺省渲染器统一以字段标签作四类控件的 `aria-label`，件不用管；**自绘面板没有这层兜底，控件名自己负责**。开关最容易漏——`OsSwitch` 的按钮内容只有一个无文字的旋钮，字段标签又是画在它旁边的兄弟节点，两者之间没有可访问名关系，缺名就是读屏里的一个无名开关。

面板同样 prop-less，走 `useWidgetConfigPanel()` 取通道：

```ts
const { instanceId, kindId, schema, values, dirty, status, patch, setValue, commit, reset, close } =
  useWidgetConfigPanel()
// status: 'idle' | 'dirty' | 'saved'；values 是草稿
```

四条硬规矩：`patch` 只改**草稿**、`commit`（或 `close` 时脏则提交）才落库；提交仍过 `sanitizeConfig`；面板**不得出现平台动作**（移除/换尺寸/停用/打开应用归卡片菜单与管理面）；面板**不得自绘材质**，且禁 import `@/kernel/stores/*`（门禁 `check:widgets` 静态扫描）。

## 点击、交互与下钻

件分三类，用显式契约字段 `interactive` 判别，不靠约定推断：

| 类型   | 声明方式                           | 平台行为                                                      |
| ------ | ---------------------------------- | ------------------------------------------------------------- |
| 展示型 | 未声明 `interactive` + `openAppId` | 整块可点，点击即下钻（带 payload 落具体内容）                 |
| 交互型 | `interactive: true`                | 平台不接管点击；下钻走卡片菜单 / `Enter` / 件自己的标题行入口 |
| 混合型 | 交互 + 有主下钻目标                | 同交互型，另在卡片菜单给「打开应用」                          |

- **下钻带 payload**：`openAppId: { appId, payloadFor(ctx) }`，`ctx = { size, config, selected }`。件把「卡片上那条内容」写进 `setSelected(...)`，落地页就是那条内容的详情位置——「只填 appId 落首页」对内置件判不合格。宿主（整块点击、菜单项）与件内 `useWidgetDrill()` 消费同一份解析结果，不会给出两种落点。
- **可达性**：目标应用当前会话 `canAccess` 不过，整块点击与菜单项一起自动消失。
- **豁免要写明**：内容本身就是答案的件（时钟、便签就地编辑）可不给下钻，但理由写进 manifest/评审。
- **动作反馈分级**：勾选/切换这类可逆动作不弹确认；删除条目与「移除件」弹一次确认；失败走通知中心。

## 管理面与种类生命周期

管理面一份实现 `src/components/WidgetConsole.vue`，两个入口共用：桌面右键「添加小组件」进的**小组件库抽屉**（桌面侧快改），与 Dock / 应用中心 / Spotlight 进的**小组件中心**（种类台账）。面板四段：搜索（消费 `keywords` + 名称 + 描述）；**桌面上的小组件**（每实例：换尺寸、就地展开配置、排序把手、⋯ 菜单、未显示成因）；**小组件**（每 kind：预览缩略、档位、tint 着色的添加钮、启用/停用/卸载收进 ⋯、无权限灰态行）；**数据**（盘点 `/我的数据` 里的孤儿文件，可一键清理——「删件不删数据」的另一半：数据永远由用户处置）。

预览是**真实渲染**不是截图：`WidgetPreview.vue` 挂 mock 上下文，几何与桌面同一套（`sizePx`），容器 `pointer-events:none` + `aria-hidden`，「预览」角标在卡片**上方独立一行**（不在卡片内，否则两宿主结构比对多出一层假分叉），懒挂载走 `IntersectionObserver` + 全局并发上限（`previewBudget`，同时最多 4 个），滑出视口即还槽。

**沙箱屏蔽的是数据与写，不屏蔽浏览器 API 读**：`navigator.storage.estimate`、`navigator.getBattery` 这类异步读在预览态照样发出，宿主不替你拦。件侧要自备其一——要么「拿不到就整项自隐」（系统类件的既有降级规则），要么在 `preview` 为真时吃件自带的样例读数（`src/widgets/storage/App.vue` 的 `SAMPLE_QUOTA`）。两者都不做，预览就发真实 I/O，并长出与桌面不一样的一棵子树。

卡片菜单条目依序：尺寸档（多档才给）→ 配置…（有 `config` 才有，宿主弹层）→ 立即刷新（声明了 `refresh` 且非 `manual`）→ 打开应用（下钻可达才有）→ 退回自动摆放（手动态才有）→ 管理小组件… → 移除（danger）。卡片表面不放浮标：移除走菜单或 `Delete`（弹确认）；`singleton` 件已在桌面时添加钮显示「已添加」并禁用。

kind 虽在构建期注册，但**装不装、开不开是用户状态**（IndexedDB `widget-kinds-v1`，缺省「已安装 + 已启用」）：

| 动作     | 语义                                                       |
| -------- | ---------------------------------------------------------- |
| **卸载** | 连带摘掉该 kind 全部实例；**可逆**，随时装回（实例不复活） |
| **停用** | 实例与配置都留着，只是桌面不渲染（停用 ≠ 删除）            |
| **安装** | 回到货架（缺省态）                                         |

派生口径分两层：`renderable` =「kind 仍注册 + 可访问 + 未卸载」，`visible` = `renderable` 再叠「已启用」——桌面层消费 `visible`，列表入口消费 `renderable`。按「随时可能被停用/卸载」设计，不要假设自己一定被渲染。

## 系统能力

- `useOS()`：`open` / `exec` / `on` / `emit`——打开应用、收发 CommandBus 事件（实例之间互不可见，共享状态走它或 VFS）。
- `useVfs()`：文件读写（业务数据请走 `useWidgetData`，不要自己拼路径）。
- `@/ui` 组件库：`Os*` 组件；不要自绘卡片材质。

## 禁止事项

1. **禁止跨小组件 / 跨应用 import**：共享能力下沉到 `kernel/` 或 `src/ui/`。
2. **禁止自绘卡片材质**：玻璃底/圆角/阴影一律由 `WidgetFrame` 提供；件内圆角不得与 `rounded-dock` 同值。
3. **禁止散落色值与魔法时长**：只消费 token 派生类；新增视觉值先进 `src/styles/tokens.css`。
4. **禁止把小组件做成应用或特殊窗口**：不进窗口体系 / Dock / 应用中心，需要窗口就用 `src/apps/`。
5. **禁止在 manifest 外注册**：不要改 `main.ts` 或壳层注册逻辑，加目录即可。
6. **禁止在组件里直连别的实例**：共享状态走 `useOS().on/emit`（CommandBus）或 VFS。
7. **禁止把演示数据塞进语言包**：语言包只放界面 chrome；预览样例文案是唯一例外（`widgets.sample.*`，且只在 `preview` 为真时解析）。
8. **禁止自持 `setInterval`**：显示心跳走 `useWidgetTick`，取数节奏走 `manifest.refresh` + 宿主调度器。
9. **禁止 `text-white` 与对前景裸 `opacity-*`**：用三档不透明 ink token（门禁归属见上面「三条同源约束」）。
10. **禁止在件内弹确认框做可逆动作**：勾选/切换随手可用；删除类才确认；失败走通知中心。
11. **禁止件内文字 <11px**：`text-micro` 在 `src/widgets/` 下禁用。
12. **禁止颜色作为唯一语义通道**：进度环配百分比数字、在线/离线配文字或形状、已完成除划线外给勾形。
13. **禁止在卡片内放 App 图标/品牌标识**：`icon`/`tint` 只属于货架磁贴。
14. **禁止重命名已发布的 kind id**：`widgets-v1` 实例与 `widget-kinds-v1` 状态都以 kind id 为键，改名等于让件连同数据引用一起消失；要改口径改 `name`/`nameKey`。
15. **禁止件内使用 `<header>` / `<footer>`**：landmark 是页面级的。卡片本身已是 `role="group"` 的 `<section>`，件内再放 `<header>` 会被 Chromium 归成 `banner`——实测 `getByRole('banner')` 从 1 个变 3 个，读屏的「跳转地标」被桌面件压过页面本身。标题行用 `div` + `text-title`。
16. **禁止「悬停才显形」的控件只有 hover 一条路**：`opacity-0 group-hover:opacity-100` 必须同挂 `group-focus-within:opacity-100`，否则键盘用户看不见它；`focus-visible:opacity-100` 是多余的（按钮自己聚焦已满足父级 `:focus-within`）。判据量 computed opacity，不用 `toBeVisible()`——`opacity: 0` 在 Playwright 里照样判定可见、照样能点。

## 提交前门禁

```bash
npm run type-check    # vue-tsc
npm run lint          # eslint
npm run check:tokens  # 无裸色值/裸圆角/裸层级
npm run check:widgets # 小组件契约静态扫描（id/nameKey/descriptionKey 齐平、下钻列有答案、configEntry 不越权、config 字段不闲置）
npm run icons:gen     # 用了新图标必须补齐白名单（--check 在 build:check 里兜底）
npm run test:unit     # vitest
npm run build:check   # 静态几道的兜底 + 包体预算 + T8 首屏静态图（件块不得进首屏，见 `scripts/check-bundle.mjs`）
```

husky pre-commit 跑 lint-staged（eslint --fix + prettier）与 type-check；生成器产物同样要通过 lint + type-check。落库前统一 `snapshot()` 剥响应式代理——重建过的数组元素是 Proxy，IndexedDB 的结构化克隆不认，会抛 `DataCloneError` 只留一行 warn。

## 内容纪律（该放什么，不是能放什么）

契约字段只保证「能渲染」；半成品感的源头是**没内容预算**。以下四条是评审判据：

- **每档有内容预算**：manifest 声明的每一个档都要写清「放什么、放几行、放不下怎么办」；没有预算表就不许开那一档。
- **宁缺不夹生**：填不满的档不声明；档位是同一理念随尺寸层层扩展，不是换一套内容。
- **溢出截断 + 计数出口，不滚动**：「还有 N 项」是链接语义，桌面件没有滚动条。
- **密度上界**：每档交互目标上限 `sm` 1 / `md` 2 / `lg` 4；命中区 ≥24×24；行数上限 `sm` 2 / `md` 4 / `lg` 8——超行截断而不是缩行高/字号。**一个「目标」＝一个决定，不是一枚按钮**：同一决定的互斥选项（一排 chip、日格单选）合计一个；「一行一个独立决定」的列表型正文与配置面**按行数上限封，不按个数计**。行数数的是内容预算里的正文行，宿主标题行与「就地新增」行不计入。
- **行高由剩余空间倒推时，上界要按最差形态算术**：`grid-template-rows: repeat(n, minmax(0,1fr))` 把格子高度交给「内框 − 其余块」，于是内容条数一多、或月份行数一到 6，格子就自己缩到地板以下。月历 lg 实测：内框 320 −（标题 29 + 表头 18 + 根间隙 12 + 议程满 115）= 146px 摊 6 行 ⇒ 每格 21px，撞上 24×24 地板；修法是**让出一行议程**（6 行月只排 2 条，余下走「还有 N 项」计数出口），不是给 `minmax` 写死 24px（那会把溢出推进 `overflow-hidden`）。判据是命中区那条腿要量**最差形态屏**（月历·lg 6 行月 + 议程满；待办·lg 把 `config.limit` 配到 schema 上界），并先断言那一屏确实是最差形态，防止上界没量到而腿自绿。播种数据因此要能填到该档内容预算的上界。
- **档位是渲染口径，不是建议**：`config` 里的可配字段不得越过该档内容预算——`clock` 在 sm 配 `seconds: true` 仍不画秒，第二时区行只给 lg（md 配上 `secondTz` 也不画）；反向也一样，缺省值给不出内容时整层不渲染而不是画一行占位。自查：把每个门控条件逐个单独拿掉跑全量，**活下来的那个 mutation 就是缺的那条腿**（「md 不画第二时区行」正是这样补出来的）。
- **新增一个 `config` 字段 = 同时交付三样**：schema、件侧读取、一条**双臂渲染腿**（两个方向都能单独变红）。持久化往返不算渲染腿——它只证 store 写得进读得回。这条由 `check:widgets` 的静态段 **T15** 拦：件目录里读不到该字段判「纯摆设」，验收 spec 里**本件 kind** 的任何 `config:{…}` 没有它判「缺渲染腿」（腿按 kind 归账——必须与 `kind:'<本件 id>'` 在同一个对象字面量里，别件的同名键不互认）。**双臂不必挤在同一次 mount 里**：`mount()` 用 `wgt-<kind>-<size>` 播种实例 id，同一次 mount 放不下两张同 kind 同档的卡（合写会撞 Playwright strict mode），所以「lg 开 / lg 关 / md 越档」三态要按档分成两条用例（`showAgenda` 现占两条）。三条门控各 mutate 一次应得到「恒不渲染 / 字段恒真 / 不分档」各红一条——同一对腿能区分这三个方向，才说明双臂是真双臂。
- **断言「这里什么都没写」要越过写合并窗口，并比整份快照内容**：`useWidgetData` 落库有 **300ms 防抖**，动作后立刻读 IDB 看到的是「还没冲出去」的旧值；再过 50ms 读一次仍相等——两次相邻相等把「尚未落盘」与「永不落盘」判成同一种东西，这条腿就自绿了。写法：立一根静默地板 `quietFloorAt = Date.now() + 2 × 300`，用 `expect.poll` 轮询，只有「与上一次读数相同**且**已过地板」才通过；比对用 `JSON.stringify(kv['fs-v1'])`（路径名 + 每个节点的内容），只比路径名集合时「改写了 `events.json` 却没增删文件」照样绿。反证：往月历「翻月」注入 `file.write({ events: [] })`，旧判据绿、新判据报 `Error: fs-v1 动了`。腿里每个动作还要各自断言「真的动了」（`aria-pressed=true`、月标题变了），否则有一个动作空跑，反向断言测的是没被碰过的屏。
- **命中区取样：宽或高为 0 不是「不用量」的理由**：按「`w>0 && h>0`」过滤会把**完全塌陷（高度 0）的可交互元素整个摘出名单**，而它恰恰最该被罚。取样条件用「仍在文档流里布局」：`getClientRects().length > 0` 且 `visibility !== 'hidden'`，宽高只作读数参与 ≥24×24 地板判定。反证：注入一个 8×0 的可聚焦按钮，旧过滤 `12 passed`，新过滤按 `calendar 命中区不达标` 点名报红。量命中区一律 `getBoundingClientRect()`——`offsetWidth/offsetHeight` 读不到 `display: contents` 与 transform 后的真实占据。
- **反证要挑「会被告知的观测点」，不是把每个守卫都碰一遍**：预览懒挂载链上 `syncSlot` 的 `inView.value &&`、`previewBudget` 的 `w.inView()`、模板的 `v-if="live && kind"` 看着都是门，但拆掉前两处**全量一条都不红**——前者只在 inView 跃迁时被调用，后者在「所有行都在视口内」的既有测试里与不过滤等价；唯一有信息量的 mutation 是**让观察者说谎**（桩掉 `IntersectionObserver` 的 `isIntersecting`）。补出的三态腿读数是 `previewSlotState()` 的 `{live,queued}: {0,0} → {3,0} → {0,0}` 配 DOM 棵数 `{0,3,0}`。纪律两条：mutation 前先问「这个守卫在测试的调用序列里有没有被真正求值」，连续两三个不红通常意味着缺的是**一整条腿**；以及**「mutation 通过」的读数必须先证明 mutation 真打上了**（`node -e` 的额外参数从 `process.argv[1]` 起算，helper 读到 `undefined` 会什么都没改却退出 0）。未进版本控制的改动线里，还原只能比 md5，不能靠 `git diff`。**这条纪律同样管自己**：本轮新加的预览 helper 让 `vitest` 16 条全绿，`vue-tsc -b` 却报 5 处 `'host' is possibly 'null'`——测试 helper 返回非空类型（`{ host, wrapper }`），别把模块级可空变量直接喂给断言；**补腿后 `type-check` 与 `lint` 要一起跑过才算数**。
- **卡片卸载钩子不得清理仍属于实例的平台状态**：卡片离开 DOM 有两种成因——实例被移除，和**视口变窄把它挤出摆放域**。后者那条 `overflow` 记录正是「+N 个未显示」清单的数据源，跟着卸载一起清掉就会变成「件不见了、出口也不响」。清理随**实例**生命周期走（`widgets.remove()` / `uninstall()`），别随卡片生命周期走。写这类判据时问一句「这个状态是被跃迁制造的吗」：是的话必须测跃迁（宽→窄→宽），开机即放不下的静态播种证不了它。
- **按计数写的让位判据要在最差视口上量一遍几何**：标语让位原判据是「占用 ≥2 个 band」，它在宽带下等价于「件压进标语区」，`cols < 8` 时却不成立——只剩一个 band，那条 band 的左缘本身已越过标语右缘。现在再加一条真实矩形相交（外接矩形 `widgetRuntime.usedRect` 由宿主同源写入）；几何权威仍只在 `WidgetLayer`，桌面侧只量标语自己那一块的盒子。两条视口腿各带一句「这一屏的前提确实成立」的自证断言。
- **浮层的可达性判据用 `toBeInViewport({ ratio })`，不是 `toBeVisible()`**：`toBeVisible()` 只回答「渲染了没有」，而 `click()` 会自己把目标滚进视口——用户没有横向滚动条可滚的地方，自动化照样点得动。溢出清单就因此挂了很久的「锚点方向错」：面板从出口左缘向右长，处置动作全在屏幕右缘之外，而所有老用例都是绿的。判「看得见、够得着」要逐元素 `toBeInViewport({ ratio: 0.9 })`（默认 `ratio: 0` 部分可见就过，等于免检），再补一次真点击 + 落库读回。写浮层类用例先问一句：**如果浏览器不肯替用户滚动，这条还绿吗？**
- **契约写「多实例互不共享」，就得有一条同 kind 两张卡的腿**：`widget-acceptance.spec.ts` 曾有句注释写着「正文按实例落库，不与其他实例共享」，而那条用例只 `mount()` 了一张便签——注释替一条不存在的第二张卡作了保。寻址契约有两层：**落点形状**（路径含实例 id）和**实例间隔离**，单实例腿只证得了前者。第二张卡不能用 `mount()` 摆（它按 `wgt-<kind>-<size>` 播种 id，两张会同 id 撞 strict mode），得走真实添加路径：桌面右键 → 添加小组件 → 选档 → 确定，跑两遍，让 store 的 `uniqueId()` 给出两个 id；取样按 `data-widget-id` 定位而不是 DOM 序号。反证要两条正交的：`widgetDataPath` 的 instance 分支去掉 `instanceId` 会让「各写各的」红（而且**先在界面上串台**：`toHaveValue` 读到对家的正文，不必等读文件），`widgets.remove()` 里连带删数据文件只让「删一张不动另一张」红。推广的口径：**文档里每一句「已达成的事实」——考卷表、manifest 字段注释、测试注释——都要能指到一条会因它失效而变红的腿**，指不到就改成描述形状或标成待证。
- **图标只有两种写法能被门禁看见，判"画对了吗"要逐 path 比**：白名单由 `npm run icons:gen` 从源码**扫字面量**生成，只认 `<OsIcon name="x">` 与 `icon: 'x'` 两种形状。`icon: ok ? 'wifi' : 'wifi-off'` 这种 ternary 它一个名字都扫不到——白名单不补，`IconName`（`keyof typeof ICON_MAP`）当场让编译不过，这一关是真的。但**运行时是无声的**：`OsIcon` 写的是 `ICON_MAP[name] ?? ICON_MAP.file`，名字绕过类型时界面就画一个 file 图标顶上去，不报错也不缺元素。所以两态字形请写成两态各一条完整字面量，别用 ternary。相应地，验收判据比的是「这一格画的到底是不是那个字形」——把 DOM 里 svg 的每条 `path d` 与 lucide 自己的图标定义逐条比（不立像素快照），只数 svg 个数的用例对上面的回落完全免检。
- **视觉基线判红：先分 staleness 与 flakiness，再按区域和 mtime 归因**：同一条用例连跑两次比 actual 的 md5——逐字节相同就是**基线过期**（欠一次重生成），不同才是**用例不稳**（回去钉不确定项）。第二步别停在「N% 不同」，把差异量到区域：`shell-3bands` 与基线只差 0.23%，红点全在「数据摘要」标题行那几个字与 Dock 带，卡片网格 / band 数 / 标语 `opacity-0` 让位逐像素复现 ⇒ 结构判据没动。第三步按 mtime 与基线生成时刻对表分账，本线自己动过的卡片表面记在本线头上，别写成「早于本线」。重生成只在**已提交的干净检出**上跑——在共享工作区跑 `--update-snapshots` 既会被策略挡下，也会把并行会话的时点像素烤进本线基线。
- **命中区与档位打架时，降级交互而不是降级内容**：小档放不下 24×24 地板，就把那一档做成阅读面（`div`）而不是硬塞按钮，能力留到大档；内容不许缩字号/缩行高迁就。判据是命中区断言**不设豁免表**——地板不达标就说明那一档不该有那个控件。案例：月历 md 的日格实测 42.3×13px，故整月网格在 md 是阅读面、点日期只在 lg（标题行下钻两档都在）。

另三条：**准入四条**（缺一不进内置件清单——主结论一句话、变化来源、下钻落点或显式豁免、配置 ≤3 项且不改也对多数用户有用）；**描述写法**（`descriptionKey`：动词开头、禁自指、句子式大写）；**降级规则**（系统类件任何指标拿不到就整项不渲染，不留 `—`/`NaN`，全拿不到进空态而不是空卡；**空态也要能做到才测得到**——月历 lg 的「今天无日程 → 农历行」是按今天过滤议程的，测试里得把事件播种到别的日子才做出那一态）。**某一态做不出来时加播种旋钮、别改默认种子**——默认那一屏正是死白/字号/命中区那批判据量的东西；验收 spec 的第 4 参 `SeedOptions` 就是为这个开的（`eventsOn`/`recentFiles`/`doneTasks`/`overdueTasks`，默认全关）。动效只允许数据更新的一次性过渡（`duration-quick`/`duration-base`，上限 2s）；件内禁持续动效（呼吸、循环 shimmer、轮播）。**单测收尾要掐掉本 store 的落库防抖**：`updateConfig` 排的是 300ms `setTimeout`，而每个 `beforeEach` 换一个全新 pinia——计时器仍挂在上一条用例的 store 实例上，它在下一条用例中途开火时会把全局 `activePinia` 拨回旧实例（Pinia 的 action 包装每次都 `setActivePinia(自己那个 pinia)`），此后组件外那句 `useWidgets()` 取到旧 store，动作打在新 store、断言读在旧 store，翻出别处的实例。一行收口：`for (const timer of Object.values(useWidgets().persistTimers)) clearTimeout(timer)`；次级守则是「mount 之后别再环境式取 store，用例开头取一次用到底」。判据用**并发红率**，不用「重跑一遍绿」。
