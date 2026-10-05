<!-- 由 scripts/gen-api-tables.mjs 从 OsMenu.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `items` | `MenuItem[]` | 是 | — | 条目树；key 为选中与 click 事件的唯一标识，全局必须唯一；children 只支持二级 |
| `mode` | `MenuMode` | 否 | `'vertical'` | 排列模式：vertical 子菜单内联展开（上下键遍历），horizontal 子菜单浮出（左右键换组） |

**Model**

| 绑定 | 类型 | 默认 |
| --- | --- | --- |
| `v-model:selectedKeys` | `string[]` | `() => []` |

**Emits**

| 事件 | 载荷 | 说明 |
| --- | --- | --- |
| `click` | `key: string` | 选中叶子条目时派发（点击或 Enter/Space）；载荷为被选中的 key，disabled 项不响应 |

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
/** OsMenu 排列模式：纵向列表 / 横向菜单栏 */
export type MenuMode = 'vertical' | 'horizontal'
```
