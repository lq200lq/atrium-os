<script setup lang="ts">
const emit = defineEmits<{ close: []; minimize: []; maximize: [] }>()
</script>

<template>
  <div class="flex items-center gap-1.5">
    <button
      class="h-3 w-3 rounded-full bg-traffic-close hover:brightness-90"
      title="关闭"
      @pointerdown.stop
      @click="emit('close')"
    />
    <button
      class="h-3 w-3 rounded-full bg-traffic-min hover:brightness-90"
      title="最小化"
      @pointerdown.stop
      @click="emit('minimize')"
    />
    <button
      class="h-3 w-3 rounded-full bg-traffic-max hover:brightness-90"
      title="最大化 / 还原"
      @pointerdown.stop
      @click="emit('maximize')"
    />
  </div>
</template>
