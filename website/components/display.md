# 展示与数据

S9 落地的五件展示类组件。共同约束：颜色只取语义刻度（`*-text` 前景 / `*-bg` 底 / `*-border` 描边），尺寸只取 `Size` 三档，禁止业务侧传裸色值 prop。

## OsTypography 排版

| 名称         | 类型                                         | 默认        | 说明                                  |
| ------------ | -------------------------------------------- | ----------- | ------------------------------------- |
| `type`       | `'text' \| 'title' \| 'paragraph' \| 'link'` | `'text'`    | 字阶与语义标签                        |
| `href`       | `string`                                     | `''`        | `link` 型的跳转目标，给了才渲染 `<a>` |
| `strong`     | `boolean`                                    | `false`     | 加粗（`font-strong` 600）             |
| `status`     | `'default' \| 'error' \| 'warning'`          | `'default'` | 非 default 时覆盖前景色，与正文色互斥 |
| `disabled`   | `boolean`                                    | `false`     | `is-disabled` 唯一写法                |
| `ellipsis`   | `boolean`                                    | `false`     | 行裁剪（`line-clamp`）                |
| `rows`       | `1 \| 2 \| 3 \| 4`                           | `1`         | 裁剪行数                              |
| `expandable` | `boolean`                                    | `false`     | 省略后追加「展开/收起」，文案走 i18n  |

字阶映射：`text`/`paragraph` → `text-ui leading-body`，`title` → `text-heading-3 font-strong`，`link` → 前景取 `text-accent-text` 且 hover 下划线。**一个区块只有一个 `title`**，层级靠字号而不是靠加粗堆叠。

::: warning 它不替代文档标题
`OsTypography` 只渲染 `<p>`（`link` 且有 `href` 时渲染 `<a>`），**不产出 `<h*>`**。区块级标题由容器负责：`OsCard` 渲染 `<h3>`、`OsDescriptions` 带 `title` 时渲染 `<h4>`。需要进入无障碍标题树的地方用容器标题，不要用 `type="title"` 冒充。（S12 接入 axe 门禁时复核这条边界。）
:::

## OsTag 标签

只做标签（属性、类型、分类）。状态指示用 `OsBadge`，成段的反馈用 `OsAlert`（S10）——三者不互换。

| 名称       | 类型          | 默认        | 说明                                               |
| ---------- | ------------- | ----------- | -------------------------------------------------- |
| `status`   | `BadgeStatus` | `'default'` | `default/error/warning/success/info` 五档预设 tint |
| `bordered` | `boolean`     | `true`      | 关掉描边保留同档底色                               |
| `closable` | `boolean`     | `false`     | 尾部× 按钮，`aria-label` 走 `common.close`         |
| `icon`     | `IconName`    | —           | 前置图标（12px）                                   |

Emits：`close`。文本走默认插槽。

## OsAvatar 头像

| 名称   | 类型       | 默认     | 说明                                     |
| ------ | ---------- | -------- | ---------------------------------------- |
| `src`  | `string`   | `''`     | 图片地址，加载失败自动回退               |
| `alt`  | `string`   | `''`     | 图片替代文本                             |
| `text` | `string`   | `''`     | 无图时的文本（首字母等），再缺省回退图标 |
| `icon` | `IconName` | `'user'` | 兜底图标                                 |
| `size` | `Size`     | `'md'`   | 直径复用控件高度刻度（24/28/32）         |

优先级 `src` > `text` > `icon`；圆形（`rounded-full`），文本底取 `bg-accent-bg` + `text-accent-text`。

## OsSegmented 分段器

| 名称       | 类型                | 默认    | 说明                                            |
| ---------- | ------------------- | ------- | ----------------------------------------------- |
| `options`  | `SegmentedOption[]` | —       | `{ value, label, icon? }`                       |
| `label`    | `string`            | `''`    | **可访问名**：`radiogroup` 没有可见标题时必须传 |
| `size`     | `Size`              | `'md'`  | 高度走 `h-control-*`                            |
| `disabled` | `boolean`           | `false` | 整组禁用                                        |
| `block`    | `boolean`           | `false` | 铺满容器，各段等宽                              |

Model：`v-model: string`（必填）。选中段的线索来自**色彩与描边**，不加粗、不换字号。

## OsTree 树

| 名称         | 类型                                      | 默认    | 说明                                                                 |
| ------------ | ----------------------------------------- | ------- | -------------------------------------------------------------------- |
| `data`       | `TreeNode[]`                              | —       | 节点树（必填）                                                       |
| `selectable` | `boolean`                                 | `true`  | 单击选中（单选）                                                     |
| `checkable`  | `boolean`                                 | `false` | 显示复选框并做父子联动                                               |
| `loadData`   | `(node: TreeNode) => Promise<TreeNode[]>` | —       | 懒加载：首次展开「无 children 且非叶子」的节点时调用，结果组件内缓存 |

```ts
interface TreeNode {
  key: string
  label: string
  children?: TreeNode[]
  disabled?: boolean
  isLeaf?: boolean // 显式声明叶子；不传且无 children 时配合 loadData
}
```

Model：`v-model:expandedKeys` / `v-model:selectedKeys` / `v-model:checkedKeys`（均 `string[]`，未绑定时退化为内部状态）。Emits：`select(node)`。

::: warning checkedKeys 的语义是「终端 key」
勾选联动以终端节点（叶子）为准，父节点只呈现 checked / indeterminate 聚合态；**写回 v-model 的是终端 key 集合**，父节点 key 不在其中。`disabled` 节点不参与父节点聚合（自身可单独勾选）。这样父目录折叠或懒加载未展开时，选中集依旧稳定。
:::

键盘导航（单 tab 停靠点，roving tabindex）：`↑`/`↓` 在可见行间移动，`→` 展开或进入子级，`←` 收起或回到父级，`Enter`/`Space` 按 `checkable > selectable > 展开` 的优先级触发。

## 用法

```vue
<OsTree :data="tree" checkable v-model:checkedKeys="keys" />
<OsTag status="success">已发布</OsTag>
<OsSegmented v-model="view" :options="[{ value: 'grid', label: '网格' }]" label="视图切换" />
```
