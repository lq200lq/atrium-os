<script setup lang="ts">
import { computed, provide } from 'vue'
import OsIcon from '@/components/OsIcon.vue'
import OsTrafficLights from '@/ui/OsTrafficLights.vue'
import OsSkeleton from '@/ui/OsSkeleton.vue'
import { useWindowDrag } from '@/kernel/composables/useWindowDrag'
import { useWindowResize, type ResizeDir } from '@/kernel/composables/useWindowResize'
import { WIN_ID_KEY } from '@/kernel/composables/useWindowContext'
import { useAppRegistry } from '@/kernel/stores/appRegistry'
import { useWindowManager, type WinState } from '@/kernel/stores/windowManager'
import { useAppName } from '@/i18n'

const props = defineProps<{ win: WinState }>()

const wm = useWindowManager()
const registry = useAppRegistry()
const appName = useAppName()
const manifest = computed(() => registry.byId(props.win.appId))
// 默认标题（等于 manifest.name）随语言本地化；应用自定义标题（如文档名）保持原样
const displayTitle = computed(() => {
  const m = manifest.value
  return m && props.win.title === m.name ? appName(m) : props.win.title
})
const { offset, dragging, onPointerdown } = useWindowDrag(props.win.id)
const { delta, resizing, start } = useWindowResize(props.win.id)

provide(WIN_ID_KEY, props.win.id)

const active = computed(() => wm.activeId === props.win.id)

const frameStyle = computed(() => ({
  left: `${props.win.x + offset.value.x + delta.value.x}px`,
  top: `${props.win.y + offset.value.y + delta.value.y}px`,
  width: `${props.win.w + delta.value.w}px`,
  height: `${props.win.h + delta.value.h}px`,
  zIndex: props.win.z,
}))

const handles: { dir: ResizeDir; cls: string }[] = [
  { dir: 'n', cls: 'top-0 inset-x-3 h-1.5 cursor-ns-resize' },
  { dir: 's', cls: 'bottom-0 inset-x-3 h-1.5 cursor-ns-resize' },
  { dir: 'e', cls: 'right-0 inset-y-3 w-1.5 cursor-ew-resize' },
  { dir: 'w', cls: 'left-0 inset-y-3 w-1.5 cursor-ew-resize' },
  { dir: 'nw', cls: 'top-0 left-0 h-3 w-3 cursor-nwse-resize' },
  { dir: 'ne', cls: 'top-0 right-0 h-3 w-3 cursor-nesw-resize' },
  { dir: 'sw', cls: 'bottom-0 left-0 h-3 w-3 cursor-nesw-resize' },
  { dir: 'se', cls: 'bottom-0 right-0 h-3 w-3 cursor-nwse-resize' },
]
</script>

<template>
  <section
    v-show="win.status !== 'minimized'"
    :class="[
      'absolute flex flex-col overflow-hidden rounded-xl border backdrop-blur-xl',
      'transition-[left,top,width,height] duration-base',
      active
        ? 'border-glass-border-active bg-glass-strong shadow-window'
        : 'border-glass-border bg-glass-base shadow-window-dim',
    ]"
    :style="[frameStyle, (dragging || resizing) && { transition: 'none' }]"
    @pointerdown="wm.focus(win.id)"
  >
    <header
      class="flex h-10 shrink-0 items-center gap-3 px-3"
      :class="active ? 'bg-glass-base' : 'bg-glass-raise'"
      @pointerdown="onPointerdown"
      @dblclick="wm.toggleMax(win.id)"
    >
      <OsTrafficLights
        @close="wm.close(win.id)"
        @minimize="wm.minimize(win.id)"
        @maximize="wm.toggleMax(win.id)"
      />
      <div
        class="flex min-w-0 flex-1 items-center justify-center gap-1.5 text-ui font-medium text-ink"
      >
        <OsIcon v-if="manifest" :name="manifest.icon" :size="14" class="text-ink-mute" />
        <span class="truncate">{{ displayTitle }}</span>
      </div>
      <div class="w-14" />
    </header>

    <div class="min-h-0 flex-1 overflow-hidden bg-glass-base">
      <Suspense>
        <KeepAlive :max="8">
          <component :is="manifest?.component" v-if="win.status !== 'minimized' && manifest" />
        </KeepAlive>
        <template #fallback>
          <div class="p-4">
            <OsSkeleton :rows="5" />
          </div>
        </template>
      </Suspense>
    </div>

    <div
      v-for="h in handles"
      :key="h.dir"
      :class="['absolute z-10', h.cls]"
      @pointerdown="start(h.dir)($event)"
    />
  </section>
</template>
