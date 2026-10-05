# 作用域配置

S11 引入的子树级配置：不改全局、不写 store——全局设置归 theme store，这里只覆盖它罩住的那棵子树。

## OsConfigProvider 作用域配置

<!--@include: ../.generated/api/OsConfigProvider.md -->

只做两件事：把配置 `provide` 给子树组件，并把可覆盖的刻度写成 CSS 变量（`.os-config` 就近重算别名）；颜色公式不在这里生成，仍只在 `tokens.css` 的派生块写一次。外框是 `contents` 布局——包装层不参与排版，只传变量与 inject。

`size` 是各控件缺省值的来源：`OsButton` / `OsInput` / `OsSelect` / `OsTextarea` / `OsInputNumber` / `OsSegmented` / `OsAvatar` 等件的 `size` 传 `undefined` 时跟随这里（经 `useControlSize` 解析），这就是它们的 props 表里默认值写 `undefined` 而非 `'md'` 的原因。

## 它作用域到哪一层

| 维度         | Provider prop                                                                  | 生效范围                                                   | 谁消费它                                                                  |
| ------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| 缺省尺寸     | `size: 'sm' \| 'md' \| 'lg'`                                                   | 子树内**没有显式 `size`** 的全部控件                       | `useControlSize()`（`OsButton` 等直接消费，input 家族经 `ControlShell`）  |
| 强调色       | `accent: 'sky' \| 'violet' \| 'emerald' \| 'rose'`                             | 子树内所有 `bg-accent` / `text-accent-*` / `border-info-*` | 根上的 `data-accent` 命中 `theme-*.css` 的预设，`.os-config` 别名就近重算 |
| 内建文案语言 | `locale: 'zh-CN' \| 'en-US'`                                                   | 子树内**组件自带**的文案                                   | `useText()`：作用域有 locale 就按该语言取词，否则回退全局 i18n            |
| 控件高度刻度 | `controlHeight: Partial<Record<Size, string>>`                                 | 子树内的 `--control-height-sm/md/lg`                       | `@utility h-control-*`（值仍是变量，不是硬编码）                          |
| 圆角刻度     | `radius: Partial<Record<'chip' \| 'control' \| 'surface' \| 'panel', string>>` | 子树内的 `--radius-*` 四档                                 | `rounded-chip/control/surface/panel`                                      |

尺寸档位的决议顺序（唯一收口点在 `src/ui/config.ts`，加档位只改这一处）：

```text
组件显式 prop  >  最近 Provider 的缺省  >  md / 全局主题 / 全局语言
```

::: warning 只管内建文案
`locale` 覆盖的是**组件内建文案**——`common.empty`（空态）、`common.selectPlaceholder`（选择占位）、`pagination.total`（共 {n} 条）、`validation.*` 这类由组件自己决定的字。应用内容文案仍走全局 `useI18n()` 的 `t`：业务页面不该因为套了一层 Provider 就把自己写的字换了语言。陈列里「作用域内」那颗按钮切到 `English` 后文案仍是「主要」，就是这条边界。
:::

嵌套时**就近生效**：`useConfig()` 取最近的一层 Provider，未覆盖的维度继续往外找；最外层没有 Provider 时行为与 S11 之前完全一致（`useConfig()` 返回 `null`，缺省 md + 全局主题 + 全局语言）。

## store 与 provider 的分工

|              | `theme` / `settings` store                                                 | `OsConfigProvider`                                     |
| ------------ | -------------------------------------------------------------------------- | ------------------------------------------------------ |
| 语义         | 用户的**全局持久化**设置                                                   | 一棵子树的**局部覆盖**                                 |
| 落点         | `document.documentElement.dataset` + IndexedDB（`theme-v1`/`settings-v1`） | Provider 自己的根元素（`data-accent` + 内联 CSS 变量） |
| 写回         | `setAccent` / `setLang` 会 `persist()`                                     | **不写 store、不落盘**，props 变了子树跟着变           |
| 刷新后       | 还原上次选择                                                               | 回到「没传」——没有残留                                 |
| 影响别的窗口 | 会（全局一致）                                                             | 不会（只在这棵子树里）                                 |

这条边界是单向的：Provider 只被子树读到，从不反向同步给 store。要全局换色/换语言仍走「设置 → 外观」，那是唯一的全局出口。

## 用法

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { OsButton, OsConfigProvider, OsEmpty, OsInput, OsSelect } from '@/ui'

const compact = ref(true)
const options = [{ value: 'a', label: 'A' }]
</script>

<template>
  <!-- 子树里控件的缺省档、强调色、内建文案语言都从这里取 -->
  <OsConfigProvider :size="compact ? 'sm' : undefined" accent="violet" locale="en-US">
    <!-- 不写 size 的按钮跟作用域走 sm；显式 size="lg" 仍然压过作用域 -->
    <OsButton variant="primary">保存</OsButton>
    <OsButton variant="primary" size="lg">主行动</OsButton>
    <!-- 占位项的内建文案（common.selectPlaceholder）说英文 -->
    <OsSelect :options="options" />
    <OsEmpty />
    <!-- 作用域内仍可单独写死档位 -->
    <OsInput size="lg" />
  </OsConfigProvider>
  <!-- 这行在作用域外：仍是全局 md 档与全局语言 -->
  <OsInput />
</template>
```

## 强调色预设

四个预设与「设置 → 外观 → 强调色」是同一批，明暗两套 seed 分别在 `theme-light.css` / `theme-dark.css`：

| 预设键    | 名称（`settings.appearance.accents.*`） | 覆盖的变量     | 命中形式                  |
| --------- | --------------------------------------- | -------------- | ------------------------- |
| `sky`     | 天蓝                                    | `--raw-accent` | `[data-accent='sky']`     |
| `violet`  | 紫罗兰                                  | `--raw-accent` | `[data-accent='violet']`  |
| `emerald` | 翡翠绿                                  | `--raw-accent` | `[data-accent='emerald']` |
| `rose`    | 玫瑰红                                  | `--raw-accent` | `[data-accent='rose']`    |

`accent` 只接受**预设键名**而不是色值——色值由 `theme-*.css` 的预设给，JS 里不出现任何 hex（`scripts/check-tokens.mjs` 的 `color-literal` 规则挡在 CI 上）。预设只写 seed，六级衍生（`-hover / -active / -bg / -bg-hover / -border / -text`）由 `tokens.css` 的公式跟着算，`info` 语义继续跟随强调色。暗主题下 `[data-theme='dark'] [data-accent='…']` 用更高特异度压过浅档，所以子树换色在暗色里同样成立。

`controlHeight` / `radius` 不在刻度表内的键（如 `xxl`、`huge`）与空值一律忽略，不会产出无主变量。

## CSS 层为什么不需要第二套公式

Tailwind 4 的 `@theme` 别名在 `:root` 上求值，子树里只改 seed 不会自动传导。S11 的补法是把「作用域」当成同一派生层的第二个宿主，而不是再抄一份公式：

1. `tokens.css` 的派生块选择器写成 `:root, .os-config` —— 子树根就近重算一遍六级衍生，公式文本仍只有一处。
2. `tokens.css` 末尾的 `.os-config` 别名块把 `--color-accent*` / `--color-info*` 重新指向同一批 `--raw-*` —— 工具类（`bg-accent`、`text-accent-text`…）在子树内就近取到覆盖后的值。这里**只有别名，没有公式**。
3. `theme-light.css` / `theme-dark.css` 的预设选择器从 `:root[data-accent='x']` 放宽成属性形式（暗档再加 `[data-theme='dark']` 后代形式）—— 带 `data-accent` 的任意后代都命中同一批预设。
4. `controlHeight` / `radius` 是字面刻度（`@theme` 内没有 var 引用），直接在根上覆盖变量即可，无需别名层。

## 刷新不残留

「不残留」是设计约束而不是副作用，验收两处：

- 单测 `tests/unit/config-provider.test.ts`：Provider 挂载后 `i18n.global.locale` 仍是原语言，根元素上只出现传进来的那几个 CSS 变量；子树内 `OsEmpty` 出英文时全局仍是中文。
- E2E `tests/e2e/config.spec.ts`：把三档都改成非默认（`lg` / 玫瑰红 / English）后 `page.reload()`，作用域控件回到「跟随作用域外 / 不覆盖 / 跟随全局」，内外两侧实测高度重新相等，`html` 上的 `data-accent` 仍是全局的 `sky`，顶栏文案一字未变。

组件侧同理：陈列里的三档取值只是局部 `ref`，既不走 `useTheme()` 也不写 IndexedDB，刷新必然回到默认。要持久化请显式调用 store 的 action，Provider 不替你做这个决定。

## 实时对照

组件陈列（Dock 的「组件陈列」）第 7 个页签「作用域配置」把左右两块并排铺开：左侧包在 `OsConfigProvider` 里，右侧是同一批组件不包。三档 `OsSegmented`（作用域尺寸 / 作用域强调色 / 作用域语言）只改左侧，高度差、`background-color` 差、内建文案语言差在同一屏里可比。
