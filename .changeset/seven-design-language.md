---
'webos': minor
---

S7 设计语言成文与 token 刻度补全：`styles/tokens.css` 重写为「刻度层 + 派生公式」结构——间距 4px 网格七级、圆角按类别六档、字阶十档（含 heading/display）、字重两档、控件高度三档、语义色 seed→六级派生（accent/danger/warning/success + info）、中性填充四档、层级七档、动效三档 + 四具名缓动、阴影几何/浓度分离；明暗与四套强调色预设改为只换 seed，衍生色由 `color-mix` 公式单点派生。新增全站 `:focus-visible` 焦点环与 `is-disabled` 禁用态唯一写法。新增 `scripts/check-tokens.mjs` 十类规则门禁（含 per-app 品牌色棘轮基线），挂 `check:tokens` / `build:check` / CI；配套 fixture 单测与焦点 E2E。设计规范文档补「设计价值观」与「刻度体系」两章，文档站 Token 页按刻度重写。
