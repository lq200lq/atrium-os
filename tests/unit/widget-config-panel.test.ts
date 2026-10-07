import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import WidgetConfigFields from '@/components/WidgetConfigFields.vue'
import WidgetConfigPanel from '@/components/WidgetConfigPanel.vue'
import { useWidgetConfigPanel } from '@/kernel/composables/useWidgetConfigPanel'
import {
  useWidgetRegistry,
  type WidgetConfigField,
  type WidgetManifest,
} from '@/kernel/stores/widgetRegistry'
import { useWidgets } from '@/kernel/stores/widgets'

/**
 * 配置面容器（§4.12）：容器建通道、面板只消费通道。
 * 这条注入链必须由单测守住——`configEntry` 是异步组件，容器漏 `provide()` 时它抛的错会被
 * 吞成一张空面板（e2e 里表现为「时钟配置打开后什么也没有」，直到桌面卡片菜单那条路把整窗崩出来）。
 */

const { idbStore } = vi.hoisted(() => ({ idbStore: new Map<string, unknown>() }))

vi.mock('@/kernel/fs/idb', () => ({
  idbGet: vi.fn(async (key: string) => idbStore.get(key)),
  idbSet: vi.fn(async (key: string, value: unknown) => {
    idbStore.set(key, value)
  }),
}))

const Stub = defineComponent({ name: 'Stub', render: () => h('p', '内容') })

/** 件自绘面板：只从通道拿东西，拿不到就在 setup 里抛 */
const ProbeEntry = defineComponent({
  name: 'ProbeEntry',
  setup() {
    const panel = useWidgetConfigPanel()
    return () =>
      h('div', [
        h('i', { 'data-probe-kind': panel.kindId }),
        h('i', { 'data-probe-schema': String(panel.schema.value.length) }),
        h('i', { 'data-probe-city': String(panel.values.value.city ?? '') }),
        h('i', { 'data-probe-dirty': String(panel.dirty.value) }),
        h('button', { onClick: () => panel.setValue('city', '大阪') }, '改城市'),
      ])
  },
})

function seedInstance(): string {
  const registry = useWidgetRegistry()
  registry.register({
    id: 'city',
    name: '城市',
    icon: 'sparkles',
    entry: () => Promise.resolve(Stub),
    widget: { sizes: ['md'], defaultSize: 'md' },
    config: [
      { key: 'city', type: 'text', label: '城市', default: '上海' },
      { key: 'rows', type: 'number', label: '行数', default: 3, min: 1, max: 6, step: 1 },
    ],
    configEntry: () => Promise.resolve(ProbeEntry),
  } as WidgetManifest)
  const widgets = useWidgets()
  const added = widgets.add('city')
  if (!added.ok) throw new Error(`前置失败：加不上实例（${added.reason}）`)
  return added.instance.id
}

const norm = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, '')

function buttonByText(host: ParentNode, text: string): HTMLButtonElement {
  const btn = Array.from(host.querySelectorAll('button')).find(
    (b) => norm(b.textContent) === norm(text),
  )
  if (!btn) throw new Error(`前置失败：找不到按钮「${text}」`)
  return btn as HTMLButtonElement
}

async function mountPanel(instanceId: string) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const wrapper = mount(WidgetConfigPanel, {
    props: { instanceId },
    attachTo: host,
  })
  await flushPromises()
  await nextTick()
  return { wrapper, host }
}

beforeEach(() => {
  setActivePinia(createPinia())
  idbStore.clear()
})

describe('WidgetConfigPanel：configEntry 与容器共用同一份通道', () => {
  it('自绘面板拿得到 kindId、schema 与草稿值（缺 provide 时异步组件会静默塌成空面板）', async () => {
    const id = seedInstance()
    const { host } = await mountPanel(id)

    expect(host.querySelector('[data-config-entry]')).toBeTruthy()
    expect(host.querySelector('[data-probe-kind]')?.getAttribute('data-probe-kind')).toBe('city')
    expect(host.querySelector('[data-probe-schema]')?.getAttribute('data-probe-schema')).toBe('2')
    expect(host.querySelector('[data-probe-city]')?.getAttribute('data-probe-city')).toBe('上海')
    expect(host.querySelector('[data-probe-dirty]')?.getAttribute('data-probe-dirty')).toBe('false')
  })

  it('面板只改草稿：点「完成」才过写边界落库', async () => {
    const id = seedInstance()
    const { wrapper, host } = await mountPanel(id)

    buttonByText(host, '改城市').click()
    await nextTick()
    expect(host.querySelector('[data-probe-dirty]')?.getAttribute('data-probe-dirty')).toBe('true')
    // 提交前线上值不动：草稿与真相分离是这一层的唯一理由
    expect(useWidgets().byId(id)?.config).not.toMatchObject({ city: '大阪' })

    buttonByText(host, '完成').click()
    await flushPromises()
    expect(useWidgets().byId(id)?.config).toMatchObject({ city: '大阪' })
    wrapper.unmount()
  })
})

describe('WidgetConfigFields：schema 缺省渲染器的可访问名', () => {
  /**
   * 四类字段控件的名字必须落在**可操作元素**上，不能只靠「标签文字就在旁边」：
   * 渲染器把字段标签画成控件的兄弟节点，`OsSwitch` 的按钮内容又只有一个无文字的旋钮，
   * 两者之间没有任何可访问名关系——少传一次 `aria-label`，读屏里就是一个无名开关。
   * axe 认得这条（`button-name`），但只有面板挂进 DOM 时才测得到，所以 e2e 侧补了「配置弹层」场景；
   * 这里再钉一层不依赖桌面种子的单位级判据：改任何一类的渲染都会红。
   */
  const fields: WidgetConfigField[] = [
    { key: 'city', type: 'text', label: '城市', default: '上海' },
    { key: 'rows', type: 'number', label: '行数', default: 3, min: 1, max: 6, step: 1 },
    {
      key: 'unit',
      type: 'select',
      label: '单位',
      options: [{ value: 'km' }, { value: 'mi' }],
      default: 'km',
    },
    { key: 'live', type: 'boolean', label: '实时刷新', default: false },
  ]

  it('四类字段各渲染出一个带 aria-label 的 input / select / button', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    mount(WidgetConfigFields, { props: { fields, modelValue: {} }, attachTo: host })
    await nextTick()

    for (const label of ['城市', '行数', '单位', '实时刷新']) {
      const named = host.querySelector(`[aria-label="${label}"]`)
      expect(named, `字段「${label}」的控件没有可访问名`).toBeTruthy()
      expect(['INPUT', 'SELECT', 'BUTTON']).toContain(named!.tagName)
    }
    // 开关的可见标签与可访问名同源（语音控制说「点击 实时刷新」要命中它）
    expect(host.querySelector('[role="switch"]')?.tagName).toBe('BUTTON')
    host.remove()
  })
})
