<!-- 由 scripts/gen-api-tables.mjs 从 OsDropdown.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `items` | `MenuItem[]` | 是 | — | 浮层内 OsMenu 的条目（含二级 children 时由 OsMenu 自行处理） |
| `trigger` | `'hover' \| 'click'` | 否 | `'click'` | 打开方式：click 点击触发槽切换；hover 移入打开、移出关闭（点击同样可开，键盘可达） |
| `placement` | `Placement` | 否 | `'bottom-start'` | 浮层方位，走 internal/placement 原语；缺省从触发槽下方左对齐展开 |
| `disabled` | `boolean` | 否 | `false` | 禁用：不响应触发，整体走 is-disabled 唯一写法 |

**Model**

| 绑定 | 类型 | 默认 |
| --- | --- | --- |
| `v-model:open` | `boolean` | `false` |

**Emits**

| 事件 | 载荷 | 说明 |
| --- | --- | --- |
| `click` | `key: string` | 浮层内菜单条目被选中时透传 OsMenu 的 click 事件；载荷为被选中的 key |

**Slots**

- `default`

**引用类型**（`src/ui/types.ts`）

```ts
/**
 * OsMenu 条目；key 为选中/点击事件的唯一标识（全局必须唯一）。
 * children 只支持二级；提供 children 的条目表现为可展开的父项而非可选项。
 */
export interface MenuItem {
  key: string
  label: string
  icon?: IconName
  disabled?: boolean
  /** 危险操作语义：文字取 danger 刻度 */
  danger?: boolean
  children?: MenuItem[]
}
/**
 * 浮层方位（S10 定位原语）：四边 × 三对齐 = 12 值。
 * OsTooltip / OsPopconfirm 共享，类串映射在 `src/ui/internal/placement.ts`。
 */
export type Placement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end'
  | 'right'
  | 'right-start'
  | 'right-end'
```
