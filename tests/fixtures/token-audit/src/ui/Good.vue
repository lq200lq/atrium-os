<template>
  <button
    class="rounded-control h-control px-sm font-strong text-ui bg-accent hover:bg-accent-hover"
  >
    ok
  </button>
  <span
    class="rounded-chip bg-danger-bg text-danger-text"
    data-token-allow="per-app 磁贴品牌色，规范 3.1 例外"
  >
    allowed
  </span>
  <!-- micro 档在件外合法（应用与壳层用它标次级元信息）；只有 src/widgets/ 下才禁 -->
  <p class="text-micro">metainfo outside widgets is fine</p>
</template>
