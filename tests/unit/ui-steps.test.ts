import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { OsSteps, type StepItem } from '@/ui'
import { classTokens } from './contract-helpers'

const items: StepItem[] = [
  { title: '填写信息', description: '完善基础资料' },
  { title: '上传附件' },
  { title: '提交完成' },
]

const indicators = (w: ReturnType<typeof mount>) => w.findAll('[data-step-indicator]')

describe('OsSteps 状态推导', () => {
  it('current 之前 finish、当前 process、之后 wait；指示圆颜色全部取语义刻度', () => {
    const w = mount(OsSteps, { props: { items, current: 1 } })
    expect(classTokens(indicators(w)[0].element)).toContain('border-accent-text')
    expect(indicators(w)[0].text()).toBe('') // finish 显示对勾 svg
    expect(indicators(w)[0].find('svg').exists()).toBe(true)
    expect(classTokens(indicators(w)[1].element)).toContain('bg-accent-bg')
    expect(classTokens(indicators(w)[2].element)).toContain('border-line')
    expect(indicators(w)[1].text()).toBe('2')
  })

  it('error=true 时当前步呈现 danger 刻度而非 process 底', () => {
    const w = mount(OsSteps, { props: { items, current: 1, error: true } })
    expect(classTokens(indicators(w)[1].element)).toContain('bg-danger-bg')
    expect(classTokens(indicators(w)[1].element)).toContain('text-danger-text')
  })

  it('当前步 aria-current=step；sr-only 输出 i18n 状态文案', () => {
    const w = mount(OsSteps, { props: { items, current: 1 } })
    const step = w.findAll('button')[1]
    expect(step.attributes('aria-current')).toBe('step')
    expect(step.text()).toContain('进行中')
    expect(w.findAll('button')[0].text()).toContain('已完成')
    expect(w.findAll('button')[2].text()).toContain('待处理')
  })

  it('description 可选渲染；title 恒渲染', () => {
    const w = mount(OsSteps, { props: { items, current: 0 } })
    expect(w.text()).toContain('完善基础资料')
    expect(w.text()).toContain('上传附件')
  })
})

describe('OsSteps 受控与跳转', () => {
  it('点击非当前步：写回 v-model:current 并派发 change(index)', async () => {
    const w = mount(OsSteps, { props: { items, current: 0 } })
    await w.findAll('button')[2].trigger('click')
    expect(w.emitted('update:current')?.at(-1)).toEqual([2])
    expect(w.emitted('change')?.at(-1)).toEqual([2])
  })

  it('点击当前步不派发 change', async () => {
    const w = mount(OsSteps, { props: { items, current: 1 } })
    await w.findAll('button')[1].trigger('click')
    expect(w.emitted('change')).toBeUndefined()
  })

  it('未绑定 v-model 时退化为内部状态（非受控点击同样推进状态）', async () => {
    const w = mount(OsSteps, { props: { items } })
    expect(indicators(w)[0].text()).toBe('1')
    await w.findAll('button')[2].trigger('click')
    expect(indicators(w)[2].text()).toBe('3')
    expect(classTokens(indicators(w)[2].element)).toContain('bg-accent-bg')
    expect(classTokens(indicators(w)[0].element)).toContain('border-accent-text')
  })
})

describe('OsSteps 横向/纵向退化', () => {
  it('默认横向（flex 行），窄容器经 w-narrow 容器查询变体切纵向', () => {
    const w = mount(OsSteps, { props: { items, current: 0 } })
    const cls = w.find('ol').classes()
    expect(cls).toContain('flex')
    expect(cls).toContain('w-narrow:flex-col')
    const li = w.findAll('li')[0].classes()
    expect(li).toContain('flex-1')
    expect(li).toContain('w-narrow:flex-initial')
  })

  it('连接线 aria-hidden，末步不渲染', () => {
    const w = mount(OsSteps, { props: { items, current: 0 } })
    const lines = w.findAll('li[aria-hidden] span, li > span[aria-hidden="true"]')
    expect(lines.length).toBeGreaterThan(0)
    const last = w.findAll('li')[2]
    expect(last.findAll('span[aria-hidden="true"]')).toHaveLength(0)
  })
})
