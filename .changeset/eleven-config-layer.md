---
'webos': minor
---

S11 全局配置层与文档自动化：新增 `OsConfigProvider`（`src/ui` 达 41 件）——一个可套在应用内任意子树上的作用域配置入口，聚合 `locale`（组件内建文案语言）、`size`（componentDefaults）、`theme`（`accent` 预设 / `controlHeight` / `radius` 刻度）。实现只有两条腿：CSS 变量写在子树根 `.os-config` 上（圆角与控件高就近覆盖；强调色只写 `data-accent` 预设名，seed 仍只在 `theme-light/dark.css` 的预设里、六级派生仍只在 `tokens.css` 的派生块里写一次），配置对象经 `provide/inject` 下发（`src/ui/config.ts` 的 `useConfig`/`useControlSize`）。职责边界按规划 §8 定案落地：`theme` store 管全局持久化设置，Provider 管子树局部覆盖且**不写 store**，所以作用域选择刷新即消失、不影响其它窗口。

控件尺寸决议收敛到 `useControlSize` 一处（显式 prop > 作用域缺省 > `md`），`ControlShell` 消费它使整个输入族自动获得作用域尺寸，`OsButton/OsSegmented/OsSpin/OsAvatar/OsTextarea` 同步；组件不再各自写 `?? 'md'`。组件内建文案改走 `src/ui/internal/text.ts` 的 `useText()`：作用域内有 `locale` 按该语言解析、否则回退全局 i18n（18 件 + `OsTrafficLights`），至此全库最后一处写死中文的 `OsSelect` 占位 `'请选择'` 收进 `common.selectPlaceholder`，并给 `OsSelect` 补 `ariaLabel` 契约（axe `select-name` 在源头解决）。

图标白名单改为脚本维护：`npm run icons:gen` 扫描 `src/` 用点补齐 `ICON_MAP`，`--check` 挂进 `build:check`——用了未登记图标即 CI 失败。规划的「lucide 全量动态解析」经实测否决：`import * as lucide` 单包 583KB，同时打爆 vendor 单块 260KB 上限与首屏 700KB 预算，且 `lucide-vue-next@0.577` 无 `DynamicIcon`；26 图标现状只占 vendor 7.9KB，`IconName` 也得以保持字面量联合（写错名字在 `vue-tsc` 就红）。

文档自动化补齐：组件清单扩到 41 件并新增 `components/config` 页，gallery 新增「作用域配置」页签（共 7 个）演示子树内 size/accent/locale 与子树外对照。
