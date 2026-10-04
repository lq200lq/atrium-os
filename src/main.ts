import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { manifest as aiAssistant } from './apps/ai-assistant/manifest'
import { manifest as appCenter } from './apps/app-center/manifest'
import { manifest as docEditor } from './apps/doc-editor/manifest'
import { manifest as fileManager } from './apps/file-manager/manifest'
import { useAppRegistry } from './kernel/stores/appRegistry'
import { useNotification } from './kernel/stores/notification'
import { useTheme } from './kernel/stores/theme'
import { useVfs } from './kernel/stores/vfs'
import { useWindowManager } from './kernel/stores/windowManager'
import './styles/main.css'

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)

const registry = useAppRegistry(pinia)
registry.register(aiAssistant)
registry.register(fileManager)
registry.register(docEditor)
registry.register(appCenter)

useNotification(pinia).boot()

const wm = useWindowManager(pinia)
wm.$subscribe(() => wm.schedulePersist())

const vfs = useVfs(pinia)
const theme = useTheme(pinia)

void Promise.all([vfs.init(), theme.restore(), wm.restoreLayout()]).then(() => app.mount('#app'))
