import { ref } from 'vue'
import { clampRect } from '../layout'
import { useWindowManager } from '../stores/windowManager'

export function useWindowDrag(winId: string) {
  const wm = useWindowManager()
  const offset = ref({ x: 0, y: 0 })
  const dragging = ref(false)

  function onPointerdown(e: PointerEvent) {
    if (e.button !== 0) return
    const win = wm.byId(winId)
    if (!win || win.status === 'maximized') return
    wm.focus(winId)
    e.preventDefault()

    const sx = e.clientX
    const sy = e.clientY
    dragging.value = true

    const onMove = (ev: PointerEvent) => {
      const w = wm.byId(winId)
      if (!w) return
      const c = clampRect({ x: w.x + ev.clientX - sx, y: w.y + ev.clientY - sy, w: w.w, h: w.h }, w.w, w.h)
      offset.value = { x: c.x - w.x, y: c.y - w.y }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      dragging.value = false
      const w = wm.byId(winId)
      if (w && (offset.value.x !== 0 || offset.value.y !== 0)) {
        wm.move(winId, w.x + offset.value.x, w.y + offset.value.y)
      }
      offset.value = { x: 0, y: 0 }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return { offset, dragging, onPointerdown }
}
