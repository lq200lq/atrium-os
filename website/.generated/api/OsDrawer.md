<!-- 由 scripts/gen-api-tables.mjs 从 OsDrawer.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `title` | `string` | 否 | `''` | 标题文字；空串时标题行仍渲染（含关闭按钮），不留空白 |
| `placement` | `'right' \| 'left'` | 否 | `'right'` | 贴靠侧；滑入轨迹按侧镜像（right 从右推入，left 从左推入） |
| `width` | `string` | 否 | `'360px'` | 抽屉宽度，直接写进内联 style 的 CSS 长度值（如 '360px'、'40%'） |

**Model**

| 绑定 | 类型 | 默认 |
| --- | --- | --- |
| `v-model` | `boolean` | — |

**Emits**

| 事件 | 载荷 | 说明 |
| --- | --- | --- |
| `close` | — | × 按钮、遮罩点击或 Esc 时派发；先置 v-model 为 false 再发出，关闭后焦点回触发元素 |

**Slots**

- `default`
- `footer`
