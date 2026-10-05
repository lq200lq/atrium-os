import { commandBus, type BusHandler } from '../bus/commandBus'
import { useAppRegistry } from '../stores/appRegistry'
import { useNotification } from '../stores/notification'
import { useSession } from '../stores/session'
import { useWindowManager } from '../stores/windowManager'

const OPEN_SUFFIX = ':open'

export function useOS() {
  const wm = useWindowManager()
  const registry = useAppRegistry()
  const session = useSession()

  return {
    open: (appId: string, payload?: unknown) => wm.open(appId, payload),

    /** 唯一鉴权判定入口：当前会话是否可访问某应用 */
    can: (appId: string) => session.canAccessApp(registry.byId(appId)),

    exec(cmd: string, payload?: unknown): boolean {
      if (cmd.endsWith(OPEN_SUFFIX)) {
        const appId = cmd.slice(0, -OPEN_SUFFIX.length)
        if (!registry.byId(appId)) {
          console.warn(`[os] 未知应用: ${appId}`)
          useNotification().push('命令未执行', `未知应用：${appId}`, undefined, 'warning')
          return false
        }
        return wm.open(appId, payload) !== null
      }
      const ok = commandBus.exec(cmd, payload)
      if (!ok) useNotification().push('命令未执行', `未注册的命令：${cmd}`, undefined, 'warning')
      return ok
    },

    on: (cmd: string, handler: BusHandler) => commandBus.on(cmd, handler),
    emit: (cmd: string, payload?: unknown) => commandBus.emit(cmd, payload),
  }
}
