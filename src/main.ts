import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { useAppRegistry, type AppManifest } from './kernel/stores/appRegistry'
import { useNotification } from './kernel/stores/notification'
import { useSession } from './kernel/stores/session'
import { useSettings } from './kernel/stores/settings'
import { useTheme } from './kernel/stores/theme'
import { useVfs } from './kernel/stores/vfs'
import { useWindowManager } from './kernel/stores/windowManager'
import './styles/main.css'

// 自动收集应用 manifest：新增/删除一个 apps/<id>/manifest.ts 即自动注册/注销，无需改此处
const manifestModules = import.meta.glob<{ manifest: AppManifest }>('./apps/*/manifest.ts', {
  eager: true,
})

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)

const registry = useAppRegistry(pinia)
for (const mod of Object.values(manifestModules)) {
  registry.register(mod.manifest)
}

useNotification(pinia).boot()

const wm = useWindowManager(pinia)
wm.$subscribe(() => wm.schedulePersist())

const vfs = useVfs(pinia)
const theme = useTheme(pinia)
const session = useSession(pinia)
const settings = useSettings(pinia)

// 先还原会话与偏好，再还原依赖它们的窗口布局（权限/固定项在布局还原前就位）
void Promise.all([session.restore(), settings.restore()])
  .then(() => Promise.all([vfs.init(), theme.restore(), wm.restoreLayout()]))
  .then(() => app.mount('#app'))
