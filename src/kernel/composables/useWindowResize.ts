import { ref } from 'vue'
import { clampRect, type Rect } from '../layout'
import { useAppRegistry } from '../stores/appRegistry'
import { useWindowManager } from '../stores/windowManager'

export type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export function useWindowResize(winId: string) {
  const wm = useWindowManager()
  const delta = ref({ x: 0, y: 0, w: 0, h: 0 })
  const resizing = ref(false)

  function start(dir: ResizeDir) {
    return (e: PointerEvent) => {
      if (e.button !== 0) return
      const win = wm.byId(winId)
      if (!win || win.status === 'maximized') return
      wm.focus(winId)
      e.preventDefault()
      e.stopPropagation()

      const spec = useAppRegistry().byId(win.appId)?.window
      const minW = spec?.minW ?? 320
      const minH = spec?.minH ?? 200
      const sx = e.clientX
      const sy = e.clientY
      const startRect: Rect = { x: win.x, y: win.y, w: win.w, h: win.h }
      resizing.value = true

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - sx
        const dy = ev.clientY - sy
        const raw: Rect = { ...startRect }
        if (dir.includes('e')) raw.w = startRect.w + dx
        if (dir.includes('s')) raw.h = startRect.h + dy
        if (dir.includes('w')) {
          raw.w = startRect.w - dx
          raw.x = startRect.x + dx
        }
        if (dir.includes('n')) {
          raw.h = startRect.h - dy
          raw.y = startRect.y + dy
        }
        const c = clampRect(raw, minW, minH)
        delta.value = {
          x: c.x - startRect.x,
          y: c.y - startRect.y,
          w: c.w - startRect.w,
          h: c.h - startRect.h,
        }
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        resizing.value = false
        wm.resize(winId, {
          x: startRect.x + delta.value.x,
          y: startRect.y + delta.value.y,
          w: startRect.w + delta.value.w,
          h: startRect.h + delta.value.h,
        })
        delta.value = { x: 0, y: 0, w: 0, h: 0 }
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }
  }

  return { delta, resizing, start }
}
