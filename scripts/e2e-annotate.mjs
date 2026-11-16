/**
 * 把 Playwright 的 JSON 报告翻译成 GitHub Actions 注解。
 *
 * 为什么需要它：Actions 的日志必须登录才能看，但 **注解（annotation）是公开的**。
 * 之前 CI 红了只知道「进程退出码 1」，翻不动任何失败用例名，只能靠猜。
 * 现在每条失败都变成 `::error file=e2e/xxx.spec.ts,line=N::用例名 — 首行报错`，
 * 既能在 PR 页面上直接点进源码行，也能用公开 API 读到。
 *
 * 用法（CI 里在 test 步骤之后、if: failure() 下执行）：
 *   node scripts/e2e-annotate.mjs
 */

import { appendFileSync, existsSync, readFileSync } from "node:fs";

const REPORT = process.env.PLAYWRIGHT_JSON ?? "test-results/results.json";

if (!existsSync(REPORT)) {
  console.log(`::warning::找不到 ${REPORT}，无法输出失败用例注解`);
  process.exit(0);
}

/** Playwright 的 JSON 是 suites 树，spec 可能挂在任意层级 */
function collect(suite, out) {
  for (const spec of suite.specs ?? []) out.push(spec);
  for (const child of suite.suites ?? []) collect(child, out);
  return out;
}

let report;
try {
  report = JSON.parse(readFileSync(REPORT, "utf8"));
} catch (error) {
  console.log(`::warning::${REPORT} 解析失败：${error.message}`);
  process.exit(0);
}

const specs = (report.suites ?? []).flatMap((suite) => collect(suite, []));
const failed = specs.filter((spec) => spec.ok === false);

const lines = [];
for (const spec of failed) {
  // 一次用例可能有多条 result（retries），取最后一条非 passed 的
  const results = spec.tests?.flatMap((test) => test.results ?? []) ?? [];
  const bad = results.filter((r) => r.status !== "passed");
  const last = bad[bad.length - 1] ?? results[results.length - 1];
  /*
   * 取前 5 行而不是第 1 行：Playwright 的 expect 报错第一行永远是
   * 「expect(received).toBe(expected)」，真正的 Expected / Received 在下面几行 ——
   * 只留首行等于什么都看不见。
   */
  const message = (last?.error?.message ?? last?.errors?.[0]?.message ?? "未知错误")
    .replace(/\u001b\[[0-9;]*m/g, "") // 去掉 ANSI 颜色
    .split("\n")
    .filter((line) => line.trim() !== "")
    .slice(0, 5)
    .join(" ⏎ ")
    .slice(0, 400)
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A");

  const file = spec.file ?? "";
  const line = spec.line ?? 1;
  console.log(`::error file=${file},line=${line},title=${spec.title}::${message}`);
  lines.push(`- \`${file}:${line}\` **${spec.title}** — ${message}`);
}

const summary = [
  `### E2E 失败 ${failed.length} / ${specs.length}`,
  "",
  ...(lines.length ? lines : ["- 报告里没有标记失败的用例（可能是 webServer 启动失败，看上面的日志）"]),
  "",
].join("\n");

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}
console.log(summary);
