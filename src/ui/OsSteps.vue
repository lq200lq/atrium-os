<script setup lang="ts">
import { computed } from 'vue'
import { useText } from './internal/text'
import OsIcon from '@/components/OsIcon.vue'
import type { StepItem, StepStatus } from './types'

export type { StepItem, StepStatus } from './types'

/** 状态 → 指示圆刻度类：唯一映射表，全部为源码静态字面量 */
const STEP_TONE: Record<StepStatus, string> = {
  finish: 'border-accent-text text-accent-text',
  process: 'border-accent-text bg-accent-bg text-accent-text',
  error: 'border-danger-text bg-danger-bg text-danger-text',
  wait: 'border-line text-ink-mute',
}

const props = withDefaults(
  defineProps<{
    /** 步骤定义（title 必填，description 可选）；顺序即流程 */
    items: StepItem[]
    /** true 时当前步呈现 error 态而非 process 态；其余步仍由 current 推导 finish/wait */
    error?: boolean
  }>(),
  { error: false },
)

const emit = defineEmits<{
  /** 点击非当前步时派发；载荷为目标索引（v-model:current 同时写回） */
  change: [index: number]
}>()

// 未绑定 v-model 时退化为内部状态，受控/非受控同一条路径
const current = defineModel<number>('current', { default: 0 })

const { t } = useText()

const statusOf = computed(() => (i: number): StepStatus => {
  if (i < current.value) return 'finish'
  if (i === current.value) return props.error ? 'error' : 'process'
  return 'wait'
})

function goTo(i: number) {
  if (i === current.value) return
  current.value = i
  emit('change', i)
}
</script>

<template>
  <ol role="list" class="flex w-narrow:flex-col text-ui">
    <li
      v-for="(item, i) in items"
      :key="`${item.title}-${i}`"
      class="relative flex min-w-0 flex-1 w-narrow:flex-initial w-narrow:pb-md"
    >
      <!-- 连接线：横向段默认显示（圆右侧到条目尾部），窄容器退化时隐藏并换纵向段 -->
      <span
        v-if="i < items.length - 1"
        aria-hidden="true"
        class="absolute left-9 right-2 top-3 border-t border-line w-narrow:hidden"
      />
      <span
        v-if="i < items.length - 1"
        aria-hidden="true"
        class="absolute bottom-0 left-3 top-9 hidden border-l border-line w-narrow:block"
      />
      <button
        type="button"
        class="flex min-w-0 flex-1 items-start gap-xs rounded-control px-2xs pb-sm text-left transition duration-quick w-narrow:flex-initial w-narrow:pb-2xs"
        :class="i === current ? 'cursor-default' : 'hover:bg-surface-hover'"
        :aria-current="statusOf(i) === 'process' ? 'step' : undefined"
        @click="goTo(i)"
      >
        <span
          data-step-indicator
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-caption font-strong"
          :class="STEP_TONE[statusOf(i)]"
        >
          <OsIcon v-if="statusOf(i) === 'finish'" name="check" :size="12" />
          <OsIcon v-else-if="statusOf(i) === 'error'" name="alert-triangle" :size="12" />
          <template v-else>{{ i + 1 }}</template>
        </span>
        <span class="min-w-0 flex-1">
          <span
            class="block truncate"
            :class="statusOf(i) === 'wait' ? 'text-ink-mute' : 'text-ink'"
          >
            {{ item.title }}
          </span>
          <span
            v-if="item.description"
            class="mt-2xs block text-caption leading-body text-ink-mute"
          >
            {{ item.description }}
          </span>
        </span>
        <span class="sr-only">{{ t(`steps.status.${statusOf(i)}`) }}</span>
      </button>
    </li>
  </ol>
</template>
