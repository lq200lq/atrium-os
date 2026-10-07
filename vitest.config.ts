import { URL, fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
)

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/unit/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // S12 质量线：作用域收口到组件层 + 内核层；i18n/windows 为既有覆盖面，保留不回落。
      // 2026-10-07 开源标准轮扩面：shell/components/widgets 三批随补测翻面（地板按实测水位下留 3~5 点，
      // 时点快照见各分档注释）。src/apps 本轮不入列：全局地板的 branches/functions 由剩余层扛住，
      // 而 apps 要进全局就得先到 branch 61.6% / func 61.4%（8 个应用含 400 语句的组件陈列全量补测），
      // 短期不可达——apps 层的腿以 e2e（apps/visual/a11y）+ 已落的状态机单测承担，入列时另立工作线。
      include: [
        'src/ui/**',
        'src/kernel/**',
        'src/i18n/**',
        'src/windows/**',
        'src/shell/**',
        'src/components/**',
        'src/widgets/**',
      ],
      // 阈值按实测水位下留 3~5 点缓冲设定（S12 实测 2026-10-05，`test:unit:coverage` 的
      // All files 行：stmts 79.83 / branch 74.96 / funcs 81.23 / lines 82.27）。
      // 分目录地板比一刀切全局更诚实：windows/i18n 的覆盖结构与组件层不同（locales 是纯数据、
      // windows 靠 E2E 验），混在一个全局阈值里只会把地板架空。两块地板各自落在其作用域
      // （`src/ui/**` 与 `src/kernel/**`）实测聚合值之下 3~5 点，抬高任一档前先跑一次看水位。
      thresholds: {
        statements: 75,
        branches: 72,
        functions: 78,
        lines: 78,
        'src/ui/**': { statements: 85, branches: 78, functions: 85, lines: 88 },
        'src/kernel/**': { statements: 65, branches: 58, functions: 70, lines: 68 },
        // 2026-10-07 实测水位：shell 81.0/66.1/76.5/83.5 · components 93.5/83.0/92.4/95.7
        'src/shell/**': { statements: 76, branches: 61, functions: 71, lines: 78 },
        'src/components/**': { statements: 88, branches: 78, functions: 87, lines: 91 },
        // 2026-10-07 实测水位：widgets 79.9/63.1/71.8/81.2
        'src/widgets/**': { statements: 75, branches: 58, functions: 67, lines: 76 },
      },
    },
  },
})
