<script setup lang="ts">
import { ref } from 'vue'
import OsIcon from '@/components/OsIcon.vue'
import { useOS } from '@/kernel/composables/useOS'
import { baseName } from '@/kernel/fs/types'
import { useNotification } from '@/kernel/stores/notification'
import { useVfs } from '@/kernel/stores/vfs'

interface Msg {
  role: 'bot' | 'user'
  text: string
  doc?: string
}

const vfs = useVfs()
const os = useOS()
const notif = useNotification()
const messages = ref<Msg[]>([
  {
    role: 'bot',
    text: '你好！我是「万物皆应用」的 AI 助手。点击下方快捷指令，我会生成一份文档并通过 CommandBus 唤起文档编辑器。',
  },
])
const input = ref('')

function send() {
  const text = input.value.trim()
  if (!text) return
  messages.value.push({ role: 'user', text })
  input.value = ''
  setTimeout(() => {
    messages.value.push({ role: 'bot', text: `（占位回复）已收到：${text}` })
  }, 300)
}

function generatePlan() {
  messages.value.push({ role: 'user', text: '帮我制定一个智慧园区数字化解决方案' })
  setTimeout(() => {
    const path = vfs.writeFile(
      '/我的文件',
      '智慧园区数字化解决方案.docx',
      '智慧园区数字化解决方案\n\n1. 建设背景与目标\n随着数字经济的快速发展，智慧园区已成为推动产业升级、提升城市治理能力的重要载体。（占位正文，可编辑）',
      'application/msword',
    )
    messages.value.push({
      role: 'bot',
      text: '方案已生成并保存到「我的文件」，可打开编辑：',
      doc: path,
    })
    notif.push('文档已生成', baseName(path))
  }, 400)
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
            打开文档
          </button>
        </div>
      </div>
    </div>
    <div class="border-t border-line p-3">
      <button
        class="mb-2 flex items-center gap-xs rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-caption text-violet-600 hover:bg-violet-100"
        @click="generatePlan"
      >
        <OsIcon name="sparkles" :size="13" />
        帮我制定智慧园区方案
      </button>
      <div class="flex items-center gap-2">
        <input
          v-model="input"
          class="h-control flex-1 rounded-full border border-line bg-surface px-md text-ui focus:border-violet-400"
          placeholder="输入你的问题…"
          @keydown.enter="send"
        />
        <button
          class="inline-flex h-control items-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 px-md text-ui text-white hover:brightness-110"
          @click="send"
        >
          发送
        </button>
      </div>
    </div>
  </div>
</template>
