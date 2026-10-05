<script setup lang="ts">
interface Layer {
  name: string
  title: string
  items?: string[]
  desc?: string
  accent?: string
}

const props = defineProps<{ layers: Layer[] }>()

// 未显式给 accent 时，按序循环这套在明暗底上都够对比的色板
const palette = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899']
const accentOf = (layer: Layer, index: number) => layer.accent ?? palette[index % palette.length]
</script>

<template>
  <div class="layer-diagram">
    <template v-for="(layer, i) in props.layers" :key="layer.name">
      <div class="layer" :style="{ '--ld-accent': accentOf(layer, i) }">
        <span class="bar" aria-hidden="true"></span>
        <div class="body">
          <div class="head">
            <code class="name">{{ layer.name }}</code>
            <span class="title">{{ layer.title }}</span>
          </div>
          <ul v-if="layer.items" class="items">
            <li v-for="item in layer.items" :key="item" class="chip">{{ item }}</li>
          </ul>
          <p v-if="layer.desc" class="desc">{{ layer.desc }}</p>
        </div>
      </div>
      <div v-if="i < props.layers.length - 1" class="link" aria-hidden="true"></div>
    </template>
  </div>
</template>

<style scoped>
.layer-diagram {
  margin: 24px 0;
}

.layer {
  display: flex;
  align-items: stretch;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid var(--vp-c-border);
  border-radius: var(--vp-radius, 8px);
  background: color-mix(in oklab, var(--ld-accent) 7%, var(--vp-c-bg-soft));
  transition: border-color 0.2s ease;
}

.layer:hover {
  border-color: color-mix(in oklab, var(--ld-accent) 45%, var(--vp-c-border));
}

.bar {
  flex: none;
  width: 4px;
  border-radius: 999px;
  background: var(--ld-accent);
}

.body {
  flex: 1;
  min-width: 0;
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.name {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 2px 8px;
  border-radius: 6px;
  color: var(--ld-accent);
  background: color-mix(in oklab, var(--ld-accent) 16%, transparent);
}

.title {
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.items {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.chip {
  /* 抵消 VitePress 全局 .vp-doc li + li { margin-top: 8px } 泄漏，避免首项与其余 chip 顶边不齐 */
  margin: 0;
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  line-height: 1.5;
  padding: 1px 9px;
  border-radius: 999px;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
}

.desc {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

.link {
  width: 2px;
  height: 14px;
  margin: 2px auto;
  border-radius: 999px;
  background: var(--vp-c-border);
}
</style>
