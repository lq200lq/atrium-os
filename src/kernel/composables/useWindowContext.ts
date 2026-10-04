import { computed, inject, type InjectionKey } from 'vue'
import { useWindowManager, type WinState } from '../stores/windowManager'

export const WIN_ID_KEY: InjectionKey<string> = Symbol('winId')

export function useWindowContext() {
  const winId = inject(WIN_ID_KEY)
  if (!winId) throw new Error('useWindowContext 必须在窗口内使用')
  const wm = useWindowManager()
  return {
    winId,
    win: computed(() => wm.byId(winId) as WinState),
  }
}
