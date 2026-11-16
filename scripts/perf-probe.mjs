/**
 * 性能探针：量化首屏与关键交互的主线程成本，并可按预算门禁。
 *
 * 用法：
 *   pnpm exec next build && pnpm exec next start --port 3100
 *   node scripts/perf-probe.mjs            # 只打印报告
 *   node scripts/perf-probe.mjs --budget   # 打印报告 + 超预算则 exit 1（CI 用）
 *
 * 自动准备压力壁纸：`public/__perf-bg.png` 缺失时从 `shots/` 里挑一张最大的图复制过去，
 * 保证 blur 相关指标有真实的大面积图层可测。
 *
 * 为什么门禁只看「结构性指标」而不是毫秒：
 *   CI 机器与本地 CPU 差一截，绝对耗时阈值必然抖动。这里卡的是**回归类别** ——
 *   「JS 又回来逐帧写样式」「首屏又多拉了几十 kB」「玻璃层又多了几层」；
 *   毫秒数只打印、不判定。
 *
 * 注意：headless Chrome 没有 GPU 合成，rAF 恒定 60，帧率不可作为判据。
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.argv.find((a) => a.startsWith("http")) ?? "http://127.0.0.1:3100";
const ENFORCE_BUDGET = process.argv.includes("--budget");

/* ------------------------------ 压力壁纸 ------------------------------ */

function ensureBackground() {
  const publicDir = join(process.cwd(), "public");
  const target = join(publicDir, "__perf-bg.png");
  if (existsSync(target)) return true;

  /*
   * `public/` 在本仓库里**没有跟踪任何文件**（构建产物才往里放），
   * 所以全新克隆（CI）里这个目录根本不存在。
   * 早先这里直接 copyFileSync，CI 上第一步就 ENOENT 崩掉 ——
   * 本地因为历史遗留的目录一直在，永远复现不出来。
   */
  mkdirSync(publicDir, { recursive: true });

  const shotsDir = join(process.cwd(), "shots");
  if (!existsSync(shotsDir)) {
    console.warn("[probe] 找不到 shots/，压力壁纸缺失：blur 相关指标仅供参考");
    return false;
  }
  const candidates = readdirSync(shotsDir)
    .filter((f) => f.endsWith(".png"))
    .map((f) => ({ f, size: statSync(join(shotsDir, f)).size }))
    .sort((a, b) => b.size - a.size);
  if (!candidates.length) {
    console.warn("[probe] shots/ 里没有 png，压力壁纸缺失：blur 相关指标仅供参考");
    return false;
  }

  copyFileSync(join(shotsDir, candidates[0].f), target);
  console.log(`[probe] 已复制压力壁纸：shots/${candidates[0].f} → public/__perf-bg.png`);
  return true;
}

const backgroundReady = ensureBackground();

/* ------------------------------ 浏览器 ------------------------------ */

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  // 2x = 典型 Retina。模糊与大面积图层在这个像素量下才接近真实成本
  deviceScaleFactor: 2,
  colorScheme: "dark",
  locale: "zh-CN",
  timezoneId: "Asia/Shanghai",
});

// 固定一份「有壁纸、无第三方请求」的配置，保证每次测量起点一致
await context.addInitScript(() => {
  window.localStorage.setItem(
    "startpage.config.v1",
    JSON.stringify({
      home: { simple: true },
      background: { source: "none" },
      wallpaper: { source: "url", value: "/__perf-bg.png" },
      weather: { enabled: false },
      quote: { source: "local" },
      suggest: { enabled: false },
    }),
  );
});

const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send("Performance.enable");

await page.addInitScript(() => {
  window.__p = { frames: [], long: [], loaf: [], running: false };

  // >50ms 的任务：主线程被单点卡住的直接证据
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__p.long.push(Math.round(entry.duration));
    }).observe({ entryTypes: ["longtask"] });
  } catch {
    /* 老浏览器没有 longtask */
  }

  // 长动画帧：把一帧拆成「脚本 / 样式布局 / 渲染」，用来判断瓶颈在 JS 还是 paint
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__p.loaf.push({
          duration: Math.round(entry.duration),
          blocking: Math.round(entry.blockingDuration ?? 0),
          styleAndLayout: Math.round((entry.styleAndLayoutStart ?? entry.startTime) - entry.startTime),
        });
      }
    }).observe({ entryTypes: ["long-animation-frame"] });
  } catch {
    /* Chrome < 123 不支持 */
  }

  /*
   * 帧采样必须按需启停：常驻 rAF 循环会让 Chrome 每帧都走一遍动画帧更新，
   * 实测会把「静息态样式重算」从 0–2 次/秒抬到 60 次/秒 —— 探针自己污染了被观测对象。
   */
  window.__startFrames = () => {
    window.__p.frames.length = 0;
    let last = performance.now();
    window.__p.running = true;
    const tick = (t) => {
      if (!window.__p.running) return;
      window.__p.frames.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  window.__stopFrames = () => {
    window.__p.running = false;
  };
});

const metrics = async () => {
  const { metrics: list } = await cdp.send("Performance.getMetrics");
  return Object.fromEntries(list.map((m) => [m.name, m.value]));
};

const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/* ------------------------------ 采样 ------------------------------ */

async function probe(label, action, waitMs, { frames = true } = {}) {
  await page.evaluate(
    (sampleFrames) => {
      window.__p.long.length = 0;
      window.__p.loaf.length = 0;
      window.__p.frames.length = 0;
      if (sampleFrames) window.__startFrames?.();
    },
    frames,
  );
  const before = await metrics();
  if (action) await action();
  await page.waitForTimeout(waitMs);
  await page.evaluate(() => window.__stopFrames?.());
  const after = await metrics();

  const collected = await page.evaluate(() => {
    const list = window.__p.frames.filter((d) => d > 0 && d < 1000);
    const sorted = [...list].sort((a, b) => a - b);
    const at = (p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0);
    return {
      long: window.__p.long,
      loaf: window.__p.loaf,
      p95: Math.round(at(0.95)),
      worst: sorted.length ? Math.round(sorted[sorted.length - 1]) : 0,
    };
  });

  return {
    label,
    taskMs: round((after.TaskDuration - before.TaskDuration) * 1000),
    styleRecalc: Math.round(after.RecalcStyleCount - before.RecalcStyleCount),
    styleMs: round((after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000),
    layouts: Math.round(after.LayoutCount - before.LayoutCount),
    layoutMs: round((after.LayoutDuration - before.LayoutDuration) * 1000),
    longTasks: collected.long.length,
    longestTask: collected.long.length ? Math.max(...collected.long) : 0,
    loaf: collected.loaf.slice(0, 5),
    p95: collected.p95,
    worst: collected.worst,
  };
}

async function audit() {
  return page.evaluate(() => {
    const all = [...document.querySelectorAll("*")];
    const cs = (el, prop) => getComputedStyle(el)[prop] || "none";
    return {
      elements: all.length,
      backdropLayers: all.filter(
        (el) => cs(el, "backdropFilter") !== "none" || cs(el, "webkitBackdropFilter") !== "none",
      ).length,
      blurredLayers: all.filter((el) => cs(el, "filter").includes("blur")).length,
      images: document.images.length,
      cssRules: [...document.styleSheets].reduce((n, sheet) => {
        try {
          return n + sheet.cssRules.length;
        } catch {
          return n;
        }
      }, 0),
    };
  });
}

async function transferKb() {
  return page.evaluate(() =>
    +(
      performance
        .getEntriesByType("resource")
        .filter((r) => r.name.endsWith(".js"))
        .reduce((n, r) => n + (r.transferSize || 0), 0) / 1024
    ).toFixed(1),
  );
}

/* ------------------------------ 场景 ------------------------------ */

await page.goto(BASE, { waitUntil: "load" });
await page
  .waitForSelector('[data-testid="wallpaper-image"][data-decoded="true"]', { timeout: 8000 })
  .catch(() => console.warn("[probe] 壁纸未就绪，blur 相关指标仅供参考"));
// 等入场动画（最晚一言 0.6s 延迟 + 0.3s 时长）彻底结束，否则 idle 窗口会把它们算进去
await page.waitForTimeout(2200);

const auditHome = await audit();
const jsKb = await transferKb();
const heap = await metrics();

const results = [];
results.push(await probe("idle 1s（静息）", null, 1000, { frames: false }));
results.push(await probe("聚焦搜索框（壁纸 +16px 模糊）", () => page.click('[data-testid="search-input"]'), 500));
results.push(
  await probe("输入 8 个字符", async () => {
    await page.type('[data-testid="search-input"]', "性能probe测试", { delay: 45 });
  }, 600),
);
const expand = await probe("展开快捷方块（高度动画 + 壁纸模糊）", () => page.click(".clock-trigger"), 900);
results.push(expand);
results.push(await probe("悬停第一个快捷方块", () => page.hover('[data-testid^="shortcut-grid-"]'), 400));
results.push(
  await probe("打开设置面板（Radix Dialog + 玻璃层）", async () => {
    await page.click('[data-testid="settings-trigger"]');
    await page.waitForTimeout(400);
  }, 900),
);
const auditSettings = await audit();

/* ------------------------------ 预算 ------------------------------ */

const idle = results[0];

/**
 * 只卡结构性指标：CPU 无关、结果稳定。
 * `current` 是 2026-11-16 的实测值，阈值留 2–4 倍余量，避免 CI 抖动误杀。
 */
const budgets = [
  { key: "首屏 JS(gzip)", value: jsKb, unit: "kB", max: 240, current: "202.6" },
  { key: "静息样式重算", value: idle.styleRecalc, unit: "次/s", max: 20, current: "3–5" },
  { key: "展开布局次数", value: expand.layouts, unit: "次", max: 80, current: "45" },
  { key: "设置面板玻璃层", value: auditSettings.backdropLayers, unit: "层", max: 10, current: "6" },
];

const failures = budgets.filter((b) => b.value > b.max);

console.log(
  JSON.stringify(
    {
      backgroundReady,
      jsTransferKb: jsKb,
      auditHome,
      auditSettings,
      heapMb: {
        jsHeapUsed: round(heap.JSHeapUsedSize / 1024 / 1024),
        nodes: heap.Nodes,
        listeners: heap.JSEventListeners,
      },
      results,
      budgets,
    },
    null,
    2,
  ),
);

console.log("\n=== 预算 ===");
for (const b of budgets) {
  const over = b.value > b.max;
  console.log(`${over ? "✗" : "✓"} ${b.key}: ${b.value}${b.unit}（上限 ${b.max}${b.unit}，基线 ${b.current}）`);
}

const loafs = results.flatMap((r) => r.loaf);
if (loafs.length) {
  const worst = loafs.reduce((a, b) => (b.duration > a.duration ? b : a));
  console.log(
    `\n长动画帧：${loafs.length} 条，最长 ${worst.duration}ms（样式布局 ${worst.styleAndLayout}ms，阻塞 ${worst.blocking}ms）`,
  );
} else {
  console.log("\n长动画帧：无（没有 >50ms 的帧）");
}

console.log("\n=== 参考耗时（不判定）===");
for (const r of [results[1], expand]) {
  console.log(`${r.label}: ${r.taskMs}ms / 布局 ${r.layouts} / 样式重算 ${r.styleRecalc}`);
}

await browser.close();

/*
 * 报告落盘：stdout 在 CI 里只能翻日志，失败时把结构化结果作为 artifact 上传更好查。
 * 放在 exit 之前写，预算失败也能拿到现场。
 */
try {
  writeFileSync(
    join(process.cwd(), "perf-report.json"),
    JSON.stringify({ backgroundReady, jsTransferKb: jsKb, auditHome, auditSettings, results, budgets }, null, 2),
  );
} catch (error) {
  console.warn(`[probe] 报告写入失败：${error.message}`);
}

if (ENFORCE_BUDGET && failures.length) {
  console.error(`\n性能预算未通过：${failures.map((f) => `${f.key}=${f.value}${f.unit}`).join(", ")}`);
  process.exit(1);
}
