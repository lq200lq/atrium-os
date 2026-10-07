import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  // S12 视觉基线按平台分目录：字体栅格化/抗锯齿跨 OS 不可比，同 OS 才是有效门禁
  snapshotPathTemplate:
    '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{platform}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      // 过渡/关键帧取结束帧，避免同一帧不同步；光标不入镜
      animations: 'disabled',
      caret: 'hide',
    },
  },
  use: {
    // 5399：5199 曾被并行会话的外部 dev server 占用且 reuseExistingServer 静默复用了它，
    // 14/14 视觉基线「假红」——端口独占 + 禁复用后，端口被占会直接报错而不是测到别人的服务
    baseURL: 'http://localhost:5399',
  },
  webServer: {
    command: 'npm run dev -- --port 5399 --strictPort',
    url: 'http://localhost:5399',
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
