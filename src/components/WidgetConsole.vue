<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OsBadge from '@/ui/OsBadge.vue'
import OsButton from '@/ui/OsButton.vue'
import OsCollapse from '@/ui/OsCollapse.vue'
import OsEmpty from '@/ui/OsEmpty.vue'
import OsIcon from './OsIcon.vue'
import OsInput from '@/ui/OsInput.vue'
import WidgetCatalogRow from './WidgetCatalogRow.vue'
import WidgetInstanceRow from './WidgetInstanceRow.vue'
import { useAppName } from '@/i18n'
import { orphanDataPaths } from '@/kernel/widget/widgetData'
import { referencedDataPaths } from '@/kernel/composables/useWidgetData'
import { useVfs } from '@/kernel/stores/vfs'
import { useFeedback } from '@/ui/feedback'
import { useWidgetRegistry, type RegisteredWidget } from '@/kernel/stores/widgetRegistry'
import { useWidgets } from '@/kernel/stores/widgets'

/**
 * 小组件管理台：外壳无关的一整块面板，合一视图四段——
 * 「桌面上的小组件」是台账（换尺寸 / 就地配置 / 排序 / 移除），「小组件」是陈列墙（预览 + 描述 + 添加），
 * 「数据」折叠盘点 VFS 里已无人引用的件数据。抽屉（`shell/WidgetGallery.vue`）与「小组件中心」应用
 * 共用这一份实现：各写一遍就是控件与文案走散的老路。根节点自带 `cq-window`——抽屉宿主没有
 * 容器查询祖先，陈列墙的 1/2/3 列在两个宿主里都要认（断点口径见 tokens.css）。
 */
const registry = useWidgetRegistry()
const widgets = useWidgets()
const vfs = useVfs()
const feedback = useFeedback()
const { t } = useI18n()
const appName = useAppName()

const term = ref('')
const catalogSection = ref<HTMLElement | null>(null)

/** 搜索消费 keywords + name + description（E7 的「预留」在此落地），台账与货架两段同步收窄 */
function matches(kind: RegisteredWidget): boolean {
  const q = term.value.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    kind.id,
    ...(kind.keywords ?? []),
    appName(kind),
    kind.name,
    kind.descriptionKey ? t(kind.descriptionKey) : (kind.description ?? ''),
    kind.description,
  ]
  return haystack.some((text) => text?.toLowerCase().includes(q))
}

const instances = computed(() =>
  widgets.renderable.filter((item) => {
    const kind = registry.byId(item.kindId)
    return kind ? matches(kind) : false
  }),
)
const hasAnyInstance = computed(() => widgets.renderable.length > 0)

const catalog = computed(() => registry.accessibleWidgets.filter(matches))
/** 无权限的 kind 不再从货架上静默消失：灰态卡只告知「需要什么角色」，桌面渲染口径不变 */
const locked = computed(() => registry.inaccessibleWidgets.filter(matches))

function scrollToCatalog() {
  catalogSection.value?.scrollIntoView({ block: 'start' })
}

const orphans = computed(() =>
  orphanDataPaths(
    Object.values(vfs.nodes),
    referencedDataPaths(widgets.items, (kindId) => registry.byId(kindId)?.data),
  ),
)

/** 数据段一月用不上一次：折叠收起，头条带孤儿计数；有孤儿时自动亮开 */
const dataOpen = ref<string[]>(orphans.value.length ? ['data'] : [])
watch(orphans, (list) => {
  if (list.length && !dataOpen.value.includes('data')) dataOpen.value = [...dataOpen.value, 'data']
})
const dataItems = computed(() => [{ key: 'data', header: t('widgets.dataSection') }])

function clearOrphans() {
  const paths = orphans.value.map((node) => node.path)
  for (const path of paths) vfs.remove(path)
  feedback.success(t('widgets.dataCleared', { n: paths.length }))
}

function baseNameOf(path: string): string {
  return path.split('/').at(-1) ?? path
}

function dirOf(path: string): string {
  return path.replace(`/${baseNameOf(path)}`, '')
}
</script>

<template>
  <div class="cq-window">
    <section data-widget-section="search" class="mb-md">
      <OsInput
        v-model="term"
        :placeholder="t('widgets.searchPlaceholder')"
        :aria-label="t('widgets.searchPlaceholder')"
        clearable
      >
        <template #prefix>
          <OsIcon name="search" :size="14" class="text-ink-mute" />
        </template>
      </OsInput>
    </section>

    <section data-widget-section="on-desktop" class="mb-lg">
      <h3 class="mb-sm text-heading-3 font-strong text-ink">{{ t('widgets.onDesktop') }}</h3>
      <OsEmpty
        v-if="!instances.length && !hasAnyInstance"
        icon="layout-grid"
        :description="t('widgets.empty')"
      >
        <template #action>
          <OsButton size="sm" @click="scrollToCatalog">{{ t('widgets.emptyCta') }}</OsButton>
        </template>
      </OsEmpty>
      <OsEmpty v-else-if="!instances.length" :description="t('widgets.noMatch')" />
      <ul v-else class="flex flex-col gap-sm">
        <WidgetInstanceRow
          v-for="instance in instances"
          :key="instance.id"
          :instance-id="instance.id"
        />
      </ul>
    </section>

    <section ref="catalogSection" data-widget-section="catalog" class="mb-lg">
      <h3 class="mb-sm text-heading-3 font-strong text-ink">{{ t('widgets.catalog') }}</h3>
      <OsEmpty v-if="!catalog.length && !locked.length" :description="t('widgets.noMatch')" />
      <ul v-else class="grid gap-sm w-narrow:grid-cols-1 w-mid:grid-cols-2 w-wide:grid-cols-3">
        <WidgetCatalogRow v-for="kind in catalog" :key="kind.id" :kind="kind" />
        <WidgetCatalogRow v-for="kind in locked" :key="`locked:${kind.id}`" :kind="kind" locked />
      </ul>
    </section>

    <section data-widget-section="data">
      <OsCollapse v-model="dataOpen" :items="dataItems">
        <template #header-data>
          <span class="flex items-center gap-xs">
            {{ t('widgets.dataSection') }}
            <OsBadge v-if="orphans.length" :count="orphans.length" />
          </span>
        </template>
        <template #panel-data>
          <p class="mb-sm text-caption leading-relaxed text-ink-mute">
            {{ t('widgets.dataIntro') }}
          </p>
          <template v-if="orphans.length">
            <p class="mb-2xs text-caption text-ink">{{ t('widgets.orphanData') }}</p>
            <ul class="mb-sm flex flex-col gap-2xs">
              <li
                v-for="node in orphans"
                :key="node.path"
                class="flex items-center gap-2xs text-caption text-ink-mute"
              >
                <OsIcon name="file" :size="12" />
                <span class="truncate">{{ baseNameOf(node.path) }}</span>
                <span class="shrink-0">{{ dirOf(node.path) }}</span>
              </li>
            </ul>
            <button
              type="button"
              data-widget-clear-orphans
              class="rounded-control px-2xs py-2xs text-caption text-danger-text transition hover:bg-danger-bg"
              @click="clearOrphans"
            >
              {{ t('widgets.clearOrphan') }}
            </button>
          </template>
          <p v-else class="text-caption text-ink-mute">{{ t('widgets.orphanDataEmpty') }}</p>
        </template>
      </OsCollapse>
    </section>
  </div>
</template>
