<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import OsButton from '@/ui/OsButton.vue'
import OsDialog from '@/ui/OsDialog.vue'
import OsEmpty from '@/ui/OsEmpty.vue'
import OsForm from '@/ui/OsForm.vue'
import OsIcon from '@/components/OsIcon.vue'
import type { FormField } from '@/ui/types'
import { normalizeWebUrl } from '@/kernel/webapp/url'
import { useWebApps, type WebAppRecord } from '@/kernel/stores/webApps'
import { useWindowManager } from '@/kernel/stores/windowManager'
import { useFeedback } from '@/ui/feedback'

/**
 * 应用中心的「网页应用」分区：把任意 http(s) 站点收进来当应用。
 * 输入只有名称 + 地址——图标固定 globe、窗口尺寸走统一默认，固定到 Dock 沿用 settings 的
 * dockPinned，不在这里再发明第二套配置面。
 */

const props = defineProps<{ query: string }>()

const { t } = useI18n()
const webApps = useWebApps()
const wm = useWindowManager()
const feedback = useFeedback()

const formRef = ref<InstanceType<typeof OsForm> | null>(null)
const form = ref<Record<string, unknown>>({ name: '', url: '' })
/** null 表示未打开；editingId 非空表示编辑既有记录 */
const dialog = ref<{ editingId: string | null } | null>(null)

const fields = computed<FormField[]>(() => [
  { key: 'name', label: t('webApp.name'), type: 'input', required: true, max: 24 },
  {
    key: 'url',
    label: t('webApp.url'),
    type: 'input',
    required: true,
    placeholder: 'https://example.com',
  },
])

const list = computed(() => {
  const kw = props.query.trim().toLowerCase()
  const items = [...webApps.items].reverse() // 后加的排前面
  return kw
    ? items.filter((r) => r.name.toLowerCase().includes(kw) || r.url.toLowerCase().includes(kw))
    : items
})

function openCreate() {
  form.value = { name: '', url: '' }
  dialog.value = { editingId: null }
}

function openEdit(rec: WebAppRecord) {
  form.value = { name: rec.name, url: rec.url }
  dialog.value = { editingId: rec.id }
}

function closeDialog() {
  dialog.value = null
}

function confirmDialog() {
  const instance = formRef.value
  if (!instance || !dialog.value) return
  if (!instance.validate()) return

  // 必填/长度已由 OsForm 拦下，协议白名单只有 webApps 的写入边界说了算。这里为把拒绝原因翻成
  // 字段文案再跑一次同一个 normalizeWebUrl（规则仍是 url.ts 一处，没有第二份判定），
  // 并把错误写回 OsForm 暴露的 errors，避免同一个表单出现两套错误呈现。
  // 文案 key 直接由 reason 拼出：多一张映射表就多一处会和语言包走散的地方。
  const parsed = normalizeWebUrl(String(form.value.url ?? ''))
  if (!parsed.ok) {
    instance.errors.url = t(`webApp.reason.${parsed.reason}`)
    return
  }
  delete instance.errors.url

  const editingId = dialog.value.editingId
  const name = String(form.value.name ?? '')
  const res = editingId
    ? webApps.update(editingId, name, String(form.value.url ?? ''))
    : webApps.add(name, String(form.value.url ?? ''))
  if (!res.ok) return // 与上面的判定同源，走不到；仅用于收窄类型
  closeDialog()
  feedback.success(editingId ? t('webApp.updated') : t('webApp.added'), res.record.name)
}

async function onRemove(rec: WebAppRecord) {
  const ok = await feedback.confirm({
    title: t('webApp.remove'),
    content: t('webApp.confirmRemove', { name: rec.name }),
    okText: t('webApp.remove'),
  })
  if (!ok) return
  // remove 连带关掉该应用的活窗口，否则布局里会留下指向幽灵应用的空白窗口
  webApps.remove(rec.id)
  feedback.success(t('webApp.removed'), rec.name)
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2">
      <span class="min-w-0 flex-1 truncate text-caption text-ink-mute">
        {{ t('webApp.count', { n: list.length }) }}
      </span>
      <OsButton variant="primary" size="sm" @click="openCreate">
        <OsIcon name="globe" :size="14" class="mr-2xs" />
        {{ t('webApp.add') }}
      </OsButton>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      <OsEmpty v-if="list.length === 0" icon="globe" :description="t('webApp.empty')" />
      <ul v-else class="m-0 flex list-none flex-col gap-2 p-0">
        <li
          v-for="rec in list"
          :key="rec.id"
          class="flex items-center gap-3 rounded-surface border border-line px-3 py-2"
        >
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-dock bg-fill-quaternary"
          >
            <OsIcon name="globe" :size="18" class="text-ink-mute" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-ink">{{ rec.name }}</span>
            <span class="block truncate text-caption text-ink-mute" :title="rec.url">
              {{ rec.url }}
            </span>
          </span>
          <OsButton size="sm" @click="wm.open(rec.id)">{{ t('webApp.open') }}</OsButton>
          <OsButton size="sm" @click="openEdit(rec)">{{ t('webApp.edit') }}</OsButton>
          <OsButton size="sm" variant="danger" @click="onRemove(rec)">
            {{ t('webApp.remove') }}
          </OsButton>
        </li>
      </ul>
    </div>

    <OsDialog
      v-if="dialog"
      :title="dialog.editingId ? t('webApp.editTitle') : t('webApp.add')"
      @confirm="confirmDialog"
      @cancel="closeDialog"
    >
      <OsForm ref="formRef" v-model="form" :fields="fields" layout="vertical">
        <template #actions><span /></template>
      </OsForm>
      <p class="mt-2 text-caption text-ink-mute">{{ t('webApp.dialogHint') }}</p>
    </OsDialog>
  </div>
</template>
