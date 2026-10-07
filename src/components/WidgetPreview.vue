<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OsIcon from '@/components/OsIcon.vue'
import ErrorBoundary from '@/windows/ErrorBoundary.vue'
import { useWidgetRegistry, type WidgetSize } from '@/kernel/stores/widgetRegistry'
import {
  WIDGET_PREVIEW_KEY,
  createPreviewWidgetContext,
  provideWidgetContext,
} from '@/kernel/composables/useWidgetContext'
import { previewSampleOf } from '@/kernel/widget/previewSamples'
import { requestPreviewSlot, retryPreviewSlots } from '@/kernel/widget/previewBudget'
import { sizePx } from '@/kernel/widget/geometry'
import { WIDGET_CARD_CLASS, widgetPaddingClass } from '@/kernel/widget/material'

/**
 * 真实渲染预览（§4.8）：把件组件挂进一个不吃指针事件的容器，尺寸就是 `sizePx(档位)`
 * ——与桌面同一套几何解，所以「预览所见」等于「桌面上多大」。缩的是已渲染的真实卡片，
 * 不是截图资产。两种取景（2026-10-07 体验重构；曾试过 contain 尽览，实测被否——
 * sm 与 lg 在同一个框里等大，「换档所见即所得」当场失效）：
 * - `lane`（缺省）：跟父容器宽等比缩（历史行为，sm 与 md 各缩各的）；
 * - `ratio`：**统一比例尺**，锚在 lg 档宽（344），同段所有预览同缩放比——保「桌面多大」的
 *   相对真值、换档变形肉眼可见。取景框宽高可固定（台账 96×96 居中留白）也可铺宽自适应
 *   （陈列卡铺满框宽、高度自然生长）。
 * 三道屏蔽由 mock 上下文与 `WIDGET_PREVIEW_KEY` 落地：数据不读真实 VFS、写是 no-op、
 * 调度不注册进宿主定时器。代价是件必须在「无真实实例」下也能渲染，这反过来验证契约干净。
 * 容器 `aria-hidden` 不进读屏顺序；必须标「预览」且不可交互（A-13）——角标只做安静标注
 * （micro 级字形），不抢件本身的视线。
 */
const props = withDefaults(
  defineProps<{
    kindId: string
    size?: WidgetSize
    fit?: 'lane' | 'ratio'
    /** 取景框宽（px）；ratio 缺省 = 跟 lane 宽铺满 */
    frameW?: number
    /** 取景框高（px）；ratio 缺省 = 内容自然高（换档时框随件长） */
    frameH?: number
  }>(),
  { size: undefined, fit: 'lane', frameW: undefined, frameH: undefined },
)

const registry = useWidgetRegistry()
const { t } = useI18n()

const kind = computed(() => registry.byId(props.kindId))
const size = ref<WidgetSize>(props.size ?? kind.value?.widget.defaultSize ?? 'sm')
watch(
  () => [props.size, props.kindId] as const,
  () => {
    size.value = props.size ?? kind.value?.widget.defaultSize ?? 'sm'
  },
)

const box = computed(() => sizePx(size.value))
/** 统一比例尺的锚：最大档卡片（344×344），ratio 模式下所有预览按它同比缩放 */
const lgBox = sizePx('lg')

/** 样例按 kindId 现取：切换预览对象时子组件会重建，注入的这份必须跟着变 */
provideWidgetContext(createPreviewWidgetContext(props.kindId, size))
provide(WIDGET_PREVIEW_KEY, {
  get sample() {
    return previewSampleOf(props.kindId)
  },
})

/* 懒挂载 + 全局并发上限：滑出视口就还槽，上限才是稳态上限（previewBudget） */
const target = ref<HTMLElement | null>(null)
const inView = ref(false)
const live = ref(false)
const avail = ref(0)
let releaseSlot: (() => void) | null = null
let viewObserver: IntersectionObserver | null = null
let sizeObserver: ResizeObserver | null = null

const frame = computed(() => {
  const w = props.frameW ?? (avail.value || lgBox.w)
  return { w, h: props.frameH ?? Math.round(box.value.h * Math.min(1, w / lgBox.w)) }
})

const scale = computed(() => {
  if (props.fit === 'lane') {
    if (!avail.value) return 1
    return Math.min(1, avail.value / box.value.w)
  }
  return Math.min(1, frame.value.w / lgBox.w)
})

const outerStyle = computed(() =>
  props.fit === 'lane'
    ? {
        width: `${Math.round(box.value.w * scale.value)}px`,
        height: `${Math.round(box.value.h * scale.value)}px`,
      }
    : { width: `${Math.round(frame.value.w)}px`, height: `${Math.round(frame.value.h)}px` },
)

/** ratio 模式卡片在取景框内居中留白（框高=自然高时上下贴边）；lane 模式贴左上（现行为） */
const innerStyle = computed(() => {
  const offset =
    props.fit === 'lane'
      ? { x: 0, y: 0 }
      : {
          x: Math.round((frame.value.w - box.value.w * scale.value) / 2),
          y: Math.round((frame.value.h - box.value.h * scale.value) / 2),
        }
  return {
    width: `${box.value.w}px`,
    height: `${box.value.h}px`,
    transform: `scale(${scale.value})`,
    left: `${offset.x}px`,
    top: `${offset.y}px`,
  }
})

function syncSlot() {
  if (inView.value && !releaseSlot) {
    releaseSlot = requestPreviewSlot(
      () => inView.value,
      (on) => {
        live.value = on
      },
    )
  } else if (!inView.value && releaseSlot) {
    releaseSlot()
    releaseSlot = null
  }
}

watch(inView, syncSlot)

onMounted(() => {
  const el = target.value
  if (!el) return
  viewObserver = new IntersectionObserver(
    (entries) => {
      inView.value = entries.some((entry) => entry.isIntersecting)
      retryPreviewSlots()
    },
    { rootMargin: '120px' },
  )
  viewObserver.observe(el)
  const lane = el.parentElement
  if (lane) {
    avail.value = lane.clientWidth
    sizeObserver = new ResizeObserver(() => {
      avail.value = lane.clientWidth
    })
    sizeObserver.observe(lane)
  }
})

onBeforeUnmount(() => {
  viewObserver?.disconnect()
  sizeObserver?.disconnect()
  viewObserver = null
  sizeObserver = null
  releaseSlot?.()
  releaseSlot = null
})
</script>

<template>
  <div
    ref="target"
    data-widget-preview
    class="flex shrink-0 flex-col items-start gap-2xs"
    :aria-label="t('widgets.previewHint')"
    :title="t('widgets.previewHint')"
  >
    <!-- A-13：预览必须标「预览」且不可交互；角标压在卡片上会盖掉件自己的首行（去色目视基线实拍到的），
         所以独立成行。2026-10-07 降权为 micro 级安静字形——它标注的是「这是假的」，不该是全行最响的元素 -->
    <span class="flex items-center gap-2xs self-start text-micro text-ink-mute">
      <OsIcon name="eye" :size="12" />
      {{ t('widgets.preview') }}
    </span>

    <!-- 取景框只做结构盒：统一比例尺下的留白直接落在行底色上。淡底衬框被实拍否掉——
         它把每行变成「白卡浮在灰盒里」，正是原管理台双框毛病的复发（阴影还被 overflow 切边） -->
    <div class="relative transition-[width,height] duration-base" :style="outerStyle">
      <div
        aria-hidden="true"
        class="pointer-events-none absolute left-0 top-0 origin-top-left transition-all duration-base"
        :class="WIDGET_CARD_CLASS"
        :style="innerStyle"
      >
        <div data-widget-content class="h-full" :class="widgetPaddingClass(kind?.padding)">
          <ErrorBoundary :app-id="`widget:${kindId}`">
            <Suspense>
              <component :is="kind?.component" v-if="live && kind" />
              <template #fallback>
                <div class="h-full w-full animate-pulse bg-widget-fill" />
              </template>
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  </div>
</template>
