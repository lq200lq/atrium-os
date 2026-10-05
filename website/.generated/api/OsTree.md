<!-- 由 scripts/gen-api-tables.mjs 从 OsTree.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `data` | `TreeNode[]` | 是 | — | 节点树；key 为展开/选中/勾选状态的唯一标识，同级必须唯一 |
| `selectable` | `boolean` | 否 | `true` | 单击选中且单选：selectedKeys 整体替换为仅含该节点；disabled 节点不响应 |
| `checkable` | `boolean` | 否 | `false` | 显示复选框并做父子聚合；v-model:checkedKeys 写回的是终端（叶子）key 集合，不含父节点 key |
| `loadData` | `(node: TreeNode) => Promise<TreeNode[]>` | 否 | `undefined` | 懒加载：首次展开「无 children 且非叶子」的节点时调用，结果由组件内部缓存 |

**Model**

| 绑定 | 类型 | 默认 |
| --- | --- | --- |
| `v-model:expandedKeys` | `string[]` | `() => []` |
| `v-model:selectedKeys` | `string[]` | `() => []` |
| `v-model:checkedKeys` | `string[]` | `() => []` |

**Emits**

| 事件 | 载荷 | 说明 |
| --- | --- | --- |
| `select` | `node: TreeNode` | 行点击派发（需 selectable 为 true 且节点非 disabled）；Enter/Space 在 checkable 开启时优先走勾选、不触发 select |

**引用类型**（`src/ui/types.ts`）

```ts
/** OsTree 节点：key 为展开/选中/勾选状态的唯一标识 */
export interface TreeNode {
  key: string
  label: string
  children?: TreeNode[]
  disabled?: boolean
  /** 显式声明为叶子；不提供 children 且非叶子时配合 loadData 走懒加载 */
  isLeaf?: boolean
}
```
