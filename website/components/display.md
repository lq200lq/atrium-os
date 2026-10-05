# 展示与数据

S9 落地的五件展示类组件。共同约束：颜色只取语义刻度（`*-text` 前景 / `*-bg` 底 / `*-border` 描边），尺寸只取 `Size` 三档，禁止业务侧传裸色值 prop。

## OsTypography 排版

<!--@include: ../.generated/api/OsTypography.md -->

字阶映射：`text`/`paragraph` → `text-ui leading-body`，`title` → `text-heading-3 font-strong`，`link` → 前景取 `text-accent-text` 且 hover 下划线。**一个区块只有一个 `title`**，层级靠字号而不是靠加粗堆叠。

::: warning 它不替代文档标题
`OsTypography` 只渲染 `<p>`（`link` 且有 `href` 时渲染 `<a>`），**不产出 `<h*>`**。区块级标题由容器负责：`OsCard` 渲染 `<h3>`、`OsDescriptions` 带 `title` 时渲染 `<h4>`。需要进入无障碍标题树的地方用容器标题，不要用 `type="title"` 冒充。（S12 接入 axe 门禁时复核这条边界。）
:::

## OsTag 标签

只做标签（属性、类型、分类）。状态指示用 `OsBadge`，成段的反馈用 `OsAlert`（S10）——三者不互换。

<!--@include: ../.generated/api/OsTag.md -->

## OsAvatar 头像

<!--@include: ../.generated/api/OsAvatar.md -->

优先级 `src` > `text` > `icon`；圆形（`rounded-full`），文本底取 `bg-accent-bg` + `text-accent-text`。

## OsSegmented 分段器

<!--@include: ../.generated/api/OsSegmented.md -->

选中段的线索来自**色彩与描边**，不加粗、不换字号。

## OsTree 树

<!--@include: ../.generated/api/OsTree.md -->

三个 model 未绑定时退化为内部状态（同通用约定）。

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
