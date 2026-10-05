<!-- 由 scripts/gen-api-tables.mjs 从 OsDialog.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `title` | `string` | 是 | — | 标题文字（必填，无 i18n 回退）；对话框不自带关闭入口，退出靠 cancel/confirm 由父级收敛 |
| `confirmText` | `string` | 否 | `''` | 确认按钮文案，空串回退 common.confirm |
| `cancelText` | `string` | 否 | `''` | 取消按钮文案，空串回退 common.cancel |
| `loading` | `boolean` | 否 | `false` | 确认按钮 loading 态：提交中由调用方置 true |
| `maskClosable` | `boolean` | 否 | `true` | true 时 pointerdown 落在遮罩（非内容区）也派发 cancel；false 则仅按钮可退出 |

**Emits**

| 事件 | 载荷 | 说明 |
| --- | --- | --- |
| `confirm` | — | 点击确认按钮派发；组件不会自行关闭，由父级据事件收敛 |
| `cancel` | — | 点击取消按钮派发；maskClosable 为 true 时点遮罩同样派发 |

**Slots**

- `default`
