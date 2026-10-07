<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import { useOS } from '@/kernel/composables/useOS'
import { baseName } from '@/kernel/fs/types'
import { useFeedback } from '@/ui/feedback'
import { useVfs } from '@/kernel/stores/vfs'

interface Msg {
  role: 'bot' | 'user'
  text: string
  doc?: string
  /** 生成失败的机器可回复态：带重试出口，不另起一套错误面板 */
  retry?: boolean
}

/** 模拟应答时延：单测用假时钟按这两个常量推进，不裸等真实时间 */
const SEND_DELAY = 300
const PLAN_DELAY = 400

const vfs = useVfs()
const os = useOS()
const feedback = useFeedback()
const { t } = useI18n()
const messages = ref<Msg[]>([{ role: 'bot', text: t('aiAssistant.greeting') }])
const input = ref('')
const pending = ref(false)

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function send() {
  const text = input.value.trim()
  if (!text || pending.value) return
  messages.value.push({ role: 'user', text })
  input.value = ''
  pending.value = true
  await wait(SEND_DELAY)
  pending.value = false
  messages.value.push({ role: 'bot', text: t('aiAssistant.placeholderReply', { text }) })
}

async function generatePlan() {
  if (pending.value) return
  messages.value.push({ role: 'user', text: t('aiAssistant.planUserMsg') })
  await runPlan()
}

/** 真实失败面只有文档写入这一处：失败落错误消息 + 重试出口，成功落文档卡 */
async function runPlan() {
  pending.value = true
  await wait(PLAN_DELAY)
  try {
    const path = vfs.writeFile(
      '/我的文件',
      '智慧园区数字化解决方案.docx',
      '智慧园区数字化解决方案\n\n1. 建设背景与目标\n随着数字经济的快速发展，智慧园区已成为推动产业升级、提升城市治理能力的重要载体。（占位正文，可编辑）',
      'application/msword',
    )
    messages.value.push({ role: 'bot', text: t('aiAssistant.planDone'), doc: path })
    feedback.success(t('aiAssistant.planSaved'), baseName(path))
  } catch (e) {
    console.error('[ai-assistant] 生成方案失败：', e)
    messages.value.push({ role: 'bot', text: t('aiAssistant.planFailed'), retry: true })
  } finally {
    pending.value = false
  }
}

function retryPlan() {
  // 错误消息本身被替换掉，重试成功/失败都只留最新一条
  messages.value.pop()
  void runPlan()
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex-1 space-y-3 overflow-y-auto p-4">
      <div
        v-for="(m, i) in messages"
        :key="i"
        :class="[
          'max-w-[85%] rounded-surface px-3 py-2 text-ui leading-relaxed',
          m.role === 'bot'
            ? 'bg-surface-hover text-ink'
            : 'ml-auto bg-gradient-to-br from-violet-500 to-purple-600 text-white',
        ]"
      >
        {{ m.text }}
        <button
          v-if="m.retry"
          class="mt-2 block rounded-control border border-line bg-surface px-xs py-2xs text-caption text-ink hover:bg-surface-hover disabled:is-disabled"
          :disabled="pending"
          @click="retryPlan"
        >
          {{ t('common.retry') }}
        </button>
        <div
          v-if="m.doc"
          class="mt-2 flex items-center gap-2 rounded-surface border border-violet-200 bg-surface px-3 py-2"
        >
          <OsIcon name="file-text" :size="20" class="shrink-0 text-accent" />
          <span class="min-w-0 flex-1 truncate text-ink">{{ baseName(m.doc) }}</span>
          <button
            class="shrink-0 rounded-control bg-violet-500 px-xs py-2xs text-white hover:brightness-110"
            @click="os.exec('doc-editor:open', { key: m.doc, path: m.doc })"
          >
            {{ t('aiAssistant.openDoc') }}
          </button>
        </div>
      </div>
      <div
        v-if="pending"
        role="status"
        class="max-w-[85%] rounded-surface bg-surface-hover px-3 py-2 text-ui text-ink-mute"
      >
        {{ t('aiAssistant.thinking') }}
      </div>
    </div>
    <div class="border-t border-line p-3">
      <button
        class="mb-2 flex items-center gap-xs rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-caption text-violet-600 hover:bg-violet-100 disabled:is-disabled"
        :disabled="pending"
        @click="generatePlan"
      >
        <OsIcon name="sparkles" :size="13" />
        {{ t('aiAssistant.quickPlan') }}
      </button>
      <div class="flex items-center gap-2">
        <input
          v-model="input"
          class="h-control flex-1 rounded-full border border-line bg-surface px-md text-ui focus:border-violet-400"
          :placeholder="t('aiAssistant.inputPlaceholder')"
          @keydown.enter="send"
        />
        <button
          class="inline-flex h-control items-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 px-md text-ui text-white hover:brightness-110 disabled:is-disabled"
          :disabled="pending"
          @click="send"
        >
          {{ t('aiAssistant.send') }}
        </button>
      </div>
    </div>
  </div>
</template>
