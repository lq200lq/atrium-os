<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 标题文字；仅作 title 插槽缺省内容（未提供插槽时显示）。title/extra 任一存在即渲染标题行 */
    title?: string
    /** 是否描边（border-line）；关掉后阴影与圆角保留 */
    bordered?: boolean
    /** 内容区是否套用 md 内边距；嵌表格/图片等铺满件时关掉 */
    padded?: boolean
  }>(),
  { title: '', bordered: true, padded: true },
)
</script>

<template>
  <section
    class="rounded-surface bg-surface shadow-raise"
    :class="bordered && 'border border-line'"
  >
    <header
      v-if="title || $slots.title || $slots.extra"
      class="flex items-center justify-between gap-sm border-b border-line px-md py-sm"
    >
      <h3 class="min-w-0 text-heading-3 font-strong text-ink">
        <slot name="title">{{ title }}</slot>
      </h3>
      <!-- 逃生口：标题行右侧操作区（如「更多」按钮） -->
      <div v-if="$slots.extra" class="flex shrink-0 items-center gap-2xs">
        <slot name="extra" />
      </div>
    </header>
    <div :class="padded && 'p-md'">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="border-t border-line px-md py-sm">
      <slot name="footer" />
    </footer>
  </section>
</template>
