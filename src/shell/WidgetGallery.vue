<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import WidgetConsole from '@/components/WidgetConsole.vue'
import OsDrawer from '@/ui/OsDrawer.vue'
import { useShellUi } from '@/kernel/stores/shellUi'

/**
 * 小组件库抽屉 = 桌面侧的快改入口（宽 380 只够原布局，加台账控件后放宽到 420）。
 * 面板本体在 `src/components/WidgetConsole.vue`，与「小组件中心」应用共用——
 * 这里只负责抽屉外壳（标题、贴侧、开合）。
 */
const ui = useShellUi()
const { t } = useI18n()
</script>

<template>
  <OsDrawer
    :model-value="ui.widgetGalleryOpen"
    :title="t('widgets.library')"
    placement="right"
    width="420px"
    @update:model-value="ui.closeWidgetGallery()"
    @close="ui.closeWidgetGallery()"
  >
    <WidgetConsole />
  </OsDrawer>
</template>
