import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, provide } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import DataBoard from '@/apps/data-board/App.vue'
import { WIN_ID_KEY } from '@/kernel/composables/useWindowContext'
import { i18n } from '@/i18n'

/**
 * 数据看板状态机（开源标准轮 L12，不入 coverage 地板、作回归腿）：
 * 初始分页加载、关键字查询、模拟异常的错误态与重试、乐观删除的回滚、新增对话框。
 * fixture 数据源带 320ms 延迟 → 全程假时钟推进。
 */

const t = (key: string, params?: Record<string, unknown>) =>
  params ? (i18n.global.t(key, params) as string) : (i18n.global.t(key) as string)

let wrapper: VueWrapper | null = null

async function mountApp() {
  const Shell = defineComponent({
    setup() {
      provide(WIN_ID_KEY, 'win-missing')
      return () => h(DataBoard)
    },
  })
  wrapper = mount(Shell, { attachTo: document.body })
  await vi.advanceTimersByTimeAsync(400)
  return wrapper
}

async function clickButton(w: VueWrapper, label: string) {
  const btn = w.findAll('button').find((b) => b.text().trim() === label)
  expect(btn, `应有按钮「${label}」`).toBeTruthy()
  await btn!.trigger('click')
  await vi.advanceTimersByTimeAsync(400)
  return btn!
}

function dataRows(w: VueWrapper) {
  return w.findAll('tbody tr').filter((r) => !r.text().includes(t('dataBoard.empty')))
}

describe('data-board 状态机', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    wrapper = null
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('初始加载：分页行 + 统计头走 i18n', async () => {
    const w = await mountApp()
    expect(dataRows(w)).toHaveLength(8)
    const stat = w.text()
    expect(stat).toContain(t('dataBoard.statTotal'))
    expect(stat).toContain(t('dataBoard.statShown'))
    // 表头五列
    const head = w.find('thead').text()
    for (const col of [
      t('dataBoard.name'),
      t('dataBoard.dept'),
      t('dataBoard.role'),
      t('dataBoard.salary'),
      t('dataBoard.joinedAt'),
    ]) {
      expect(head, `表头应有「${col}」`).toContain(col)
    }
  })

  it('关键字查询：过滤生效，无命中给空态', async () => {
    const w = await mountApp()
    const input = w.get('input[type="text"], input:not([type])')
    await input.setValue('绝无此人xyz')
    await clickButton(w, t('common.search'))
    expect(w.text()).toContain(t('dataBoard.empty'))
  })

  it('模拟异常：错误态 + 内建重试，关掉后恢复行', async () => {
    const w = await mountApp()
    // OsSwitch：label 文本在按钮外层的 <label> 里，开关本体是 button[role=switch]
    const wrap = w.findAll('label').find((l) => l.text().includes(t('dataBoard.failSwitch')))
    expect(wrap, '应有模拟异常开关').toBeTruthy()
    const sw = wrap!.get('button[role="switch"]')
    await sw.trigger('click')
    await vi.advanceTimersByTimeAsync(400)
    // fixture 的失败消息直出（非 loadFailed 回退），错误态替换表体、带内建重试
    expect(w.text()).toContain('模拟异常')
    expect(w.text()).toContain(t('common.retry'))
    expect(w.findAll('tbody tr')).toHaveLength(1) // 只剩错误态一行，数据行被替换

    await sw.trigger('click')
    await vi.advanceTimersByTimeAsync(400)
    expect(dataRows(w)).toHaveLength(8)
  })

  it('删除成功：行数即减且不回滚', async () => {
    const w = await mountApp()
    expect(dataRows(w)).toHaveLength(8)
    const del = w.findAll('tbody button').find((b) => b.text().trim() === t('common.delete'))
    expect(del, '行内删除按钮应存在').toBeTruthy()
    await del!.trigger('click')
    await vi.advanceTimersByTimeAsync(400)
    expect(dataRows(w)).toHaveLength(7)
  })

  it('新增对话框：必填校验拦空提交，补齐后落新行', async () => {
    const w = await mountApp()
    await clickButton(w, t('dataBoard.create'))
    expect(w.text()).toContain(t('dataBoard.dialogCreate'))

    // 空提交被必填校验拦下（对话框不关）
    let confirm = w.findAll('button').find((b) => b.text().trim() === t('common.confirm'))
    await confirm!.trigger('click')
    await vi.advanceTimersByTimeAsync(400)
    expect(w.find('[role="dialog"]').exists(), '校验未过对话框应保留').toBe(true)

    // 补齐 name / role 两个必填（部门是 OsSelect 不占 input 序号：0=姓名 1=职位 2=薪资 3=日期）
    const inputs = w.findAll('[role="dialog"] input:not([type="checkbox"])')
    await inputs[0].setValue('验收新人')
    await inputs[1].setValue('测试工程师')
    confirm = w.findAll('button').find((b) => b.text().trim() === t('common.confirm'))
    await confirm!.trigger('click')
    await vi.advanceTimersByTimeAsync(500)
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    // 新行按插入序落在末页，用关键字查询把它捞出来
    const keyword = w.get('input[type="text"], input:not([type])')
    await keyword.setValue('验收新人')
    await clickButton(w, t('common.search'))
    expect(w.text()).toContain('验收新人')
  })
})
