import { commandBus, type BusHandler } from '../bus/commandBus'
import { useAppRegistry } from '../stores/appRegistry'
import { useNotification } from '../stores/notification'
import { useWindowManager } from '../stores/windowManager'

const OPEN_SUFFIX = ':open'

export function useOS() {
  const wm = useWindowManager()
  const registry = useAppRegistry()

  return {
    open: (appId: string, payload?: unknown) => wm.open(appId, payload),

    exec(cmd: string, payload?: unknown): boolean {
      if (cmd.endsWith(OPEN_SUFFIX)) {
        const appId = cmd.slice(0, -OPEN_SUFFIX.length)
        if (!registry.byId(appId)) {
          console.warn(`[os] 未知应用: ${appId}`)
          useNotification().push('命令未执行', `未知应用：${appId}`)
          return false
        }
        return wm.open(appId, payload) !== null
      }
      const ok = commandBus.exec(cmd, payload)
      if (!ok) useNotification().push('命令未执行', `未注册的命令：${cmd}`)
      return ok
    },

    on: (cmd: string, handler: BusHandler) => commandBus.on(cmd, handler),
    emit: (cmd: string, payload?: unknown) => commandBus.emit(cmd, payload),
  }
}
