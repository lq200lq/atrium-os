<script setup lang="ts">
import WidgetConsole from '@/components/WidgetConsole.vue'

/**
 * 小组件中心：种类台账（安装 / 启用 / 卸载）与桌面实例的总入口。
 * 面板本体与小组件库抽屉共用 `WidgetConsole`，这里只给一个能滚的窗口容器。
 */
</script>

<template>
  <div class="h-full overflow-y-auto p-lg text-ui text-ink">
    <WidgetConsole />
  </div>
</template>
