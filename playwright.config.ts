import { defineConfig, devices } from "@playwright/test";

/**
 * E2E 配置（PRD 目录要求：e2e/）
 * - 自动拉起生产构建（next start）以保证与交付物一致
 * - 只跑 Chromium，减少本地安装成本；CI 可加 --project 扩展
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"]],
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    colorScheme: "dark",
  },
  // 使用本机已安装的 Chrome（channel: "chrome"），避免额外下载浏览器内核
  projects: [
    { name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
  ],
  webServer: {
    // 注意：pnpm 不像 npm 那样需要 `--` 分隔，写 `-- --port` 会被当成目录名
    command: "pnpm run build && pnpm run start --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
