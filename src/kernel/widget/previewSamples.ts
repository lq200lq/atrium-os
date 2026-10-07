/**
 * 件自带的预览样例（§4.8 屏蔽 ① 的数据源）：`src/widgets/<kindId>/preview.json`，
 * 键与 `manifest.data` 对齐。glob 是构建期的，所以「新增一件就多一份样例」不需要平台侧改代码。
 *
 * 日期敏感的那两件（今日待办、月历）不写在这里：它们的样例由
 * `kernel/widget/taskSchedule.ts` 的 `sampleTasks()` / `sampleEvents()` 按「今天」生成——
 * 静态日期会被「今天」这个筛选条件滤空，预览会成一张空卡。
 */
const files = import.meta.glob('../../widgets/*/preview.json', {
  eager: true,
  import: 'default',
}) as Record<string, Record<string, unknown>>

const byKind: Record<string, Record<string, unknown>> = {}
for (const [path, data] of Object.entries(files)) {
  const kindId = path.split('/').at(-2)
  if (kindId) byKind[kindId] = data
}

export function previewSampleOf(kindId: string): Record<string, unknown> | undefined {
  return byKind[kindId]
}
