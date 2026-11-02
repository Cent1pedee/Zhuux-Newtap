import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    css: false,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // 纯样式入口没有可执行分支，纳入统计只会稀释信号
      exclude: ["src/**/*.d.ts", "src/styles/**"],
      reporter: ["text-summary", "text"],
      /*
       * 基线（2026-11-02 实测）：语句 75.7% / 分支 76.8% / 函数 77.0%。
       * 阈值取基线下方约 5 个点：既能拦住「新代码一行测试都不写」的倒退，
       * 又不会因为重构挪动几行未覆盖代码就红灯。
       * 要抬阈值先补测试，不要反过来放宽阈值迁就实现。
       */
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
});
