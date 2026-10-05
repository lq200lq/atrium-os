import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import LayerDiagram from './components/LayerDiagram.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('LayerDiagram', LayerDiagram)
  },
} satisfies Theme
