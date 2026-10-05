<!-- 由 scripts/gen-api-tables.mjs 从 OsProgress.vue 生成，勿手改 -->

| Prop | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `percent` | `number` | 否 | `0` | 进度百分比；内部钳制到 0..100 |
| `type` | `ProgressType` | 否 | `'line'` |  |
| `status` | `ProgressStatus` | 否 | `undefined` | 缺省时由 percent 推导：满格即 success——「进度走完」与「成功」在数据上等价， 让调用方手动同步 status 只会多一处漂移源；exception 是旁路失败信号，数据推不出， 必须显式传入。 |
| `strokeWidth` | `number` | 否 | `undefined` | 描边厚度（px）：line 为轨道厚度，circle 为 SVG 环宽；缺省走刻度档 |
| `showInfo` | `boolean` | 否 | `true` |  |

**引用类型**（`src/ui/types.ts`）

```ts
/** OsProgress 状态；缺省时 success 由 percent 满格推导，exception 必须显式传入 */
export type ProgressStatus = 'normal' | 'success' | 'exception'
/** OsProgress 形态：条形 / 环形 */
export type ProgressType = 'line' | 'circle'
```
