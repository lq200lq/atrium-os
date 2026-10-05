<!-- 由 scripts/gen-api-tables.mjs 从 OsResult.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `status` | `ResultStatus` | 否 | `'success'` |  |
| `title` | `string` | 否 | `''` |  |
| `subtitle` | `string` | 否 | `''` |  |

**Slots**

- `default`
- `icon`
- `extra`

**引用类型**（`src/ui/types.ts`）

```ts
/** OsResult 结果页四型；`403` 承接 S2 鉴权拒绝的落地表现 */
export type ResultStatus = 'success' | 'error' | '403' | 'warning'
```
