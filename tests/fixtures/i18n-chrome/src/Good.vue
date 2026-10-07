<template>
  <div>
    <span>{{ t('demo.label') }}</span>
    <button :title="t('demo.delete')">ok</button>
    <p>{{ label }}</p>
    <span data-i18n-allow="浏览器原生 tooltip 演示，非界面 chrome">悬停提示</span>
  </div>
</template>
