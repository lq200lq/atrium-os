import { isSelfEmbedded, renderSelfEmbedGuard, selfEmbedCause } from './kernel/boot/embedGuard'
// 样式在入口就 import：降级页要吃到 token，而被嵌入时 `main.ts` 整条模块图都不求值。
import './styles/main.css'

// 入口只做一件事：判定这层文档是不是被本站自己嵌着。是 → 只渲染一行能读懂的说明；
// 否 → 启动壳层。壳层仍由 `main.ts` 负责（glob 自动注册、restore 顺序都在那里），
// 这里改成动态导入，为的是「被嵌入时内核一行都不执行」——详见 kernel/boot/embedGuard.ts。
// 代价是顶层首屏多一跳往返（入口 4.2KB 先落，再拉 89.3KB 的壳层块）：`scripts/check-bundle.mjs`
// 因此把 `main-*` 计进首屏总量，别让它变成一笔没人负责的字节。
if (isSelfEmbedded()) {
  renderSelfEmbedGuard(document, selfEmbedCause(location.pathname))
} else {
  void import('./main')
}
