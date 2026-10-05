<script setup lang="ts">
import { useText } from './internal/text'

const emit = defineEmits<{ close: []; minimize: []; maximize: [] }>()
const { t } = useText()
</script>

<template>
  <div class="flex items-center gap-xs">
    <button
      class="h-3 w-3 rounded-full bg-traffic-close hover:brightness-90"
      :title="t('window.close')"
      @pointerdown.stop
      @click="emit('close')"
    />
    <button
      class="h-3 w-3 rounded-full bg-traffic-min hover:brightness-90"
      :title="t('window.minimize')"
      @pointerdown.stop
      @click="emit('minimize')"
    />
    <button
      class="h-3 w-3 rounded-full bg-traffic-max hover:brightness-90"
      :title="t('window.maximize')"
      @pointerdown.stop
      @click="emit('maximize')"
    />
  </div>
</template>
