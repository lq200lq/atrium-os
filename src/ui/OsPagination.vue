<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    pageSize?: number
    total: number
  }>(),
  { pageSize: 10 },
)

const page = defineModel<number>({ required: true })
const { t } = useI18n()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))

// 页码窗口：当前页居中，最多 5 个
const pages = computed(() => {
  const span = 5
  let start = Math.max(1, page.value - Math.floor(span / 2))
  const end = Math.min(totalPages.value, start + span - 1)
  start = Math.max(1, end - span + 1)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
})

function go(p: number) {
  if (p >= 1 && p <= totalPages.value) page.value = p
}
</script>

<template>
  <div class="flex items-center justify-end gap-1 text-ui text-ink">
    <span class="mr-2 text-caption text-ink-mute">{{ t('pagination.total', { n: total }) }}</span>
    <button
      class="rounded border border-line px-2 py-0.5 disabled:opacity-40"
      :disabled="page <= 1"
      @click="go(page - 1)"
    >
      {{ t('pagination.prev') }}
    </button>
    <button
      v-for="p in pages"
      :key="p"
      class="min-w-7 rounded border px-2 py-0.5"
      :class="
        p === page ? 'border-accent bg-accent text-on-accent' : 'border-line hover:bg-surface-hover'
      "
      @click="go(p)"
    >
      {{ p }}
    </button>
    <button
      class="rounded border border-line px-2 py-0.5 disabled:opacity-40"
      :disabled="page >= totalPages"
      @click="go(page + 1)"
    >
      {{ t('pagination.next') }}
    </button>
  </div>
</template>
