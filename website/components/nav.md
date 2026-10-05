# 导航组件

S10-B 的四件导航件。共同前提：数据驱动（`items` 进、事件出，不接收裸 DOM）；键盘行为与焦点管理复用 S10-A 定下的浮层纪律（打开进浮层、Esc/外点关闭、焦点回触发元素）；定位一律经 `src/ui/internal/placement.ts` 原语，层级取 `z-panel`（下拉/浮层档，见 `styles/tokens.css`），不做 viewport 翻转（同原语取舍）。

## OsMenu 菜单

<!--@include: ../.generated/api/OsMenu.md -->

`role="menu"` + `role="menuitem"`，roving tabindex（整组只占一个 tab 停靠点，同 `OsTree` 的做法）。两种模式：`vertical` 子菜单内联展开（上下键遍历、左右键进出子级），`horizontal` 顶层左右换组、下键浮出子菜单（menubar 惯例，同时只浮出一组）。`danger` 与 `disabled` 是条目仅有的两份额外语义——danger 取 `text-danger-text` 刻度，disabled 项 `aria-disabled` + 点击/键盘双守卫，不可激活但仍可聚焦（读者知道"有但不可用"）。选中态经 `v-model:selectedKeys` 写回，未绑定时退化为内部状态。

## OsDropdown 下拉菜单

<!--@include: ../.generated/api/OsDropdown.md -->

触发槽 + 菜单浮层的薄壳：浮层内部就是一个 `mode="vertical"` 的 `OsMenu`，键盘导航完全委托给它，不在此重抄。`trigger: 'click' | 'hover'`；click 型打开时焦点进菜单首项，hover 型不抢键盘焦点。Esc 关闭、外点关闭、关闭后焦点还给触发元素——`document` 上的 `pointerdown` 只在打开期间挂、关闭与卸载都解绑（与 `OsPopconfirm` 同一套纪律）。`placement` 走 12 值定位原语，层级 `z-panel`。

## OsBreadcrumb 面包屑

<!--@include: ../.generated/api/OsBreadcrumb.md -->

末项恒为当前页：`aria-current="page"` + 原生 `disabled`，不可点。分隔符由组件独立渲染（`aria-hidden` 的 span，`separator` prop 可覆写），永不混进条目文本。超过 `maxVisibleItems`（≥3 生效）时中间层级折叠进省略号控件——下拉直接复用 `OsDropdown`，选中后把原始 `BreadcrumbItem` 经 `click` 事件回传（file-manager 路径栏即此用法：点任意祖先层级 `navigate(path)`）。`href` 条目渲染为链接、保留跳转语义。

## OsSteps 步骤条

<!--@include: ../.generated/api/OsSteps.md -->

`v-model:current` + `finish / process / error / wait` 四态由 `current` 推导（`error` prop 只把当前步从 process 换成 error，其余不变）。指示圆配色全部取语义刻度（`STEP_TONE` 映射表，静态字面量）；当前步 `aria-current="step"`，状态文案经 `sr-only` 输出（i18n `steps.status.*`）。点击非当前步跳步并派发 `change`。响应式按**窗口**不按视口：`w-narrow` 容器查询变体把横向排布退化为纵向堆叠（连接线同步换向），与 `OsGrid` / `OsDescriptions` 同一机制。

## 键盘速查

| 场景         | 按键                                                                     |
| ------------ | ------------------------------------------------------------------------ |
| 纵向菜单     | `↑/↓` 遍历（含展开的子级），`→` 展开、`←` 收起，`Enter`/`Space` 激活     |
| 横向菜单     | `←/→` 换组，`↓` 浮出子菜单，子级内 `↑/↓` 浏览，`Esc` 收组回父项          |
| OsDropdown   | 触发元素上 `Enter`/`Space` 打开；浮层内方向键走 OsMenu；`Esc` 关闭并回焦 |
| OsBreadcrumb | 省略号即 `OsDropdown` 触发钮，键盘语义同上                               |
| OsSteps      | 每步是一个可聚焦按钮，`Enter` 跳步                                       |
