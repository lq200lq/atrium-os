<script setup lang="ts">
import { computed, provide } from 'vue'
import OsIcon from '@/components/OsIcon.vue'
import { useWindowDrag } from '@/kernel/composables/useWindowDrag'
import { useWindowResize, type ResizeDir } from '@/kernel/composables/useWindowResize'
import { WIN_ID_KEY } from '@/kernel/composables/useWindowContext'
import { useAppRegistry } from '@/kernel/stores/appRegistry'
import { useWindowManager, type WinState } from '@/kernel/stores/windowManager'

const props = defineProps<{ win: WinState }>()

const wm = useWindowManager()
const registry = useAppRegistry()
const manifest = computed(() => registry.byId(props.win.appId))
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
      'transition-[left,top,width,height] duration-200',
      active
        ? 'border-white/60 bg-white/85 shadow-2xl shadow-slate-900/30'
        : 'border-white/40 bg-white/70 shadow-lg shadow-slate-900/15',
    ]"
    :style="[frameStyle, (dragging || resizing) && { transition: 'none' }]"
    @pointerdown="wm.focus(win.id)"
  >
    <header
      class="flex h-10 shrink-0 items-center gap-3 px-3"
      :class="active ? 'bg-white/70' : 'bg-white/40'"
      @pointerdown="onPointerdown"
      @dblclick="wm.toggleMax(win.id)"
    >
      <div class="flex items-center gap-1.5">
        <button
          class="h-3 w-3 rounded-full bg-[#ff5f57] hover:brightness-90"
          title="关闭"
          @pointerdown.stop
          @click="wm.close(win.id)"
        />
        <button
          class="h-3 w-3 rounded-full bg-[#febc2e] hover:brightness-90"
          title="最小化"
          @pointerdown.stop
          @click="wm.minimize(win.id)"
        />
        <button
          class="h-3 w-3 rounded-full bg-[#28c840] hover:brightness-90"
          title="最大化 / 还原"
          @pointerdown.stop
          @click="wm.toggleMax(win.id)"
        />
      </div>
      <div class="flex min-w-0 flex-1 items-center justify-center gap-1.5 text-[13px] font-medium text-slate-700">
        <OsIcon v-if="manifest" :name="manifest.icon" :size="14" class="text-slate-500" />
        <span class="truncate">{{ win.title }}</span>
      </div>
      <div class="w-14" />
    </header>

    <div class="min-h-0 flex-1 overflow-hidden bg-white/60">
      <KeepAlive :max="8">
        <component :is="manifest?.component" v-if="win.status !== 'minimized' && manifest" />
      </KeepAlive>
    </div>

    <div
      v-for="h in handles"
      :key="h.dir"
      :class="['absolute z-10', h.cls]"
      @pointerdown="start(h.dir)($event)"
    />
  </section>
</template>
