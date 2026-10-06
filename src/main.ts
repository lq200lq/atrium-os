import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { useAppRegistry, type AppManifest } from './kernel/stores/appRegistry'
import { useNotification } from './kernel/stores/notification'
import { useSession } from './kernel/stores/session'
import { useSettings } from './kernel/stores/settings'
import { useTheme } from './kernel/stores/theme'
import { useVfs } from './kernel/stores/vfs'
import { useWebApps } from './kernel/stores/webApps'
import { useWindowManager } from './kernel/stores/windowManager'
import { useErrorLog } from './kernel/observability/errorLog'
import { i18n } from './i18n'

// 自动收集应用 manifest：新增/删除一个 apps/<id>/manifest.ts 即自动注册/注销，无需改此处
const manifestModules = import.meta.glob<{ manifest: AppManifest }>('./apps/*/manifest.ts', {
  eager: true,
})

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.use(i18n)

const registry = useAppRegistry(pinia)
for (const mod of Object.values(manifestModules)) {
  registry.register(mod.manifest)
}

useNotification(pinia).boot()

// 全局错误可观测：组件错误经 app.config.errorHandler，运行时/未处理 Promise 经 window 监听，
// 统一落错误日志环形缓冲（窗口级错误由 ErrorBoundary 就地捕获，返回 false 后不会到达此处）。
const errorLog = useErrorLog(pinia)
app.config.errorHandler = (err) => {
  errorLog.captureError('global', err)
}
window.addEventListener('error', (e) => {
  errorLog.captureError('global', e.error ?? e.message)
})
window.addEventListener('unhandledrejection', (e) => {
  errorLog.captureError('global', e.reason)
})

const wm = useWindowManager(pinia)
wm.$subscribe(() => wm.schedulePersist())

const vfs = useVfs(pinia)
const theme = useTheme(pinia)
const session = useSession(pinia)
const settings = useSettings(pinia)
const webApps = useWebApps(pinia)

// 先还原会话与偏好，再还原依赖它们的窗口布局（权限/固定项在布局还原前就位）。
// 用户添加的网页应用必须在第一波注册：windowManager.restoreLayout 会丢掉注册表里查不到的 appId。
void Promise.all([session.restore(), settings.restore(), errorLog.restore(), webApps.restore()])
  .then(() => {
    for (const rec of webApps.items) registry.register(webApps.toManifest(rec))
    return Promise.all([vfs.init(), theme.restore(), wm.restoreLayout()])
  })
  // 这里不再有「被嵌入就不挂载」的判断：那件事已经由 src/entry.ts 在启动之前挡掉，
  // 走到这份文件的文档一定是顶层窗口（否则整套内核连求值都不会求）。
  .then(() => app.mount('#app'))
