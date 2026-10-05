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
      include: ['src/ui/**', 'src/kernel/**', 'src/i18n/**', 'src/windows/**'],
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
      },
    },
  },
})
