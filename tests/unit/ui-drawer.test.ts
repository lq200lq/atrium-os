import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { OsDrawer } from '@/ui'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('OsDrawer', () => {
  it('打开渲染内容，关闭按钮派发 update:modelValue 与 close', async () => {
    const w = mount(OsDrawer, {
      props: { modelValue: true, title: '抽屉标题' },
      slots: { default: '<p>抽屉内容X</p>' },
    })
    await nextTick()
    expect(document.body.textContent).toContain('抽屉内容X')
    const closeBtn = document.body.querySelector('button[title="关闭"]') as HTMLButtonElement
    closeBtn.click()
    await nextTick()
    expect(w.emitted('update:modelValue')?.[0]).toEqual([false])
    expect(w.emitted('close')).toBeTruthy()
  })

  it('关闭态不渲染抽屉面板', async () => {
    mount(OsDrawer, { props: { modelValue: false }, slots: { default: '<p>隐藏内容</p>' } })
    await nextTick()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('placement 决定贴边方向与滑入方向', async () => {
    mount(OsDrawer, { props: { modelValue: true, placement: 'left' } })
    await nextTick()
    const panel = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(panel.classList.contains('left-0')).toBe(true)
    expect(panel.classList.contains('border-r')).toBe(true)
    // 滑入轨迹必须镜像，否则左抽屉从右侧推进来
    expect(panel.classList.contains('slide-from-left')).toBe(true)

    document.body.innerHTML = ''
    mount(OsDrawer, { props: { modelValue: true, placement: 'right' } })
    await nextTick()
    const right = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(right.classList.contains('right-0')).toBe(true)
    expect(right.classList.contains('slide-from-left')).toBe(false)
  })

  it('footer 插槽存在时才渲染底部区', async () => {
    mount(OsDrawer, {
      props: { modelValue: true },
      slots: { footer: '<b>底部操作</b>' },
    })
    await nextTick()
    expect(document.body.querySelector('footer b')?.textContent).toBe('底部操作')

    document.body.innerHTML = ''
    mount(OsDrawer, { props: { modelValue: true } })
    await nextTick()
    expect(document.body.querySelector('footer')).toBeNull()
  })
})
