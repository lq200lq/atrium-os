import { config } from '@vue/test-utils'
import { i18n } from '@/i18n'

// 所有挂载的组件默认安装 i18n 插件，使 useI18n() 在单测中可用（默认中文）
config.global.plugins = [i18n]
