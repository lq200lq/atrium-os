import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick, ref } from 'vue'
import ErrorBoundary from '@/windows/ErrorBoundary.vue'
import { useErrorLog } from '@/kernel/observability/errorLog'

vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async () => undefined),
  idbSet: vi.fn(async () => {}),
}))

// 每个用例独立的抛错开关与子组件，避免模块级响应式状态跨用例串扰
function makeBoom() {
  const shouldThrow = ref(true)
  const Boom = defineComponent({
    setup() {
      return () => {
        if (shouldThrow.value) throw new Error('child render boom')
        return h('span', { class: 'ok' }, 'recovered')
      }
    },
  })
  return { shouldThrow, Boom }
}

describe('ErrorBoundary 窗口级错误边界', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('子树渲染抛错时就地显示错误态并落日志', async () => {
    const { Boom } = makeBoom()
    const wrapper = mount(ErrorBoundary, {
      props: { appId: 'gallery' },
      slots: { default: () => h(Boom) },
    })
    await nextTick()
    expect(wrapper.text()).toContain('应用出错了')
    expect(wrapper.text()).toContain('child render boom')

    const log = useErrorLog()
    expect(log.entries).toHaveLength(1)
    expect(log.entries[0].scope).toBe('window')
    expect(log.entries[0].appId).toBe('gallery')
    wrapper.unmount()
  })

  it('重新加载后子树恢复渲染', async () => {
    const { shouldThrow, Boom } = makeBoom()
    const wrapper = mount(ErrorBoundary, {
      props: { appId: 'gallery' },
      slots: { default: () => h(Boom) },
    })
    await nextTick()
    expect(wrapper.find('.ok').exists()).toBe(false)

    shouldThrow.value = false
    await wrapper.find('button').trigger('click')
    await nextTick()
    expect(wrapper.find('.ok').exists()).toBe(true)
    expect(wrapper.text()).toContain('recovered')
    wrapper.unmount()
  })

  it('无错误时正常渲染插槽', () => {
    const { shouldThrow, Boom } = makeBoom()
    shouldThrow.value = false
    const wrapper = mount(ErrorBoundary, {
      slots: { default: () => h(Boom) },
    })
    expect(wrapper.find('.ok').exists()).toBe(true)
    expect(useErrorLog().count).toBe(0)
    wrapper.unmount()
  })
})
