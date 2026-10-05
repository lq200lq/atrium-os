<script setup lang="ts">
import { ref } from 'vue'
import OsDialog from '@/ui/OsDialog.vue'
import { useNotification } from '@/kernel/stores/notification'
import {
  provideFeedback,
  type ConfirmOptions,
  type FeedbackApi,
  type NotifyOptions,
} from '@/ui/feedback'

/**
 * 反馈宿主：挂在壳层根节点，把命令式 notify/confirm 通过 provide 交给整棵应用树。
 * 通知数据本身仍只有 `useNotification` 一份——分级、吐司、通知中心消费同一个来源。
 */
const notif = useNotification()

const dialog = ref<ConfirmOptions & { open: boolean }>({ open: false, title: '' })
let settle: ((ok: boolean) => void) | null = null

const api: FeedbackApi = {
  notify: (o: NotifyOptions) => notif.push(o.title, o.body, o.action, o.level ?? 'info'),
  success: (title, body) => notif.push(title, body, undefined, 'success'),
  error: (title, body) => notif.push(title, body, undefined, 'error'),
  warning: (title, body) => notif.push(title, body, undefined, 'warning'),
  info: (title, body) => notif.push(title, body, undefined, 'info'),
  confirm: (options: ConfirmOptions) => {
    // 后发起的确认覆盖前一个，并把前一个判为取消——不留永不 resolve 的 Promise
    settle?.(false)
    settle = null
    dialog.value = { ...options, open: true }
    return new Promise<boolean>((resolve) => {
      settle = resolve
    })
  },
}
provideFeedback(api)

function close(ok: boolean) {
  dialog.value.open = false
  const pending = settle
  settle = null
  pending?.(ok)
}
</script>

<template>
  <!-- 宿主包一层壳层子树：provide 只覆盖后代，应用窗口必须在其内才拿得到反馈上下文 -->
  <slot />
  <OsDialog
    v-if="dialog.open"
    :title="dialog.title"
    :confirm-text="dialog.okText"
    :cancel-text="dialog.cancelText"
    @confirm="close(true)"
    @cancel="close(false)"
  >
    <p v-if="dialog.content" class="text-ui text-ink">{{ dialog.content }}</p>
  </OsDialog>
</template>
