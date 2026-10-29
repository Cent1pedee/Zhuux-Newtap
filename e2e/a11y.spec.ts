import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * 无障碍扫描（PRD 6.2 / 6.4）：axe-core 在真实浏览器里扫首页与三个浮层，
 * 断言没有 serious / critical 级问题。moderate 及以下不阻断。
 */

const CONFIG_KEY = "startpage.config.v1";

async function fresh(page: Page) {
  await page.addInitScript(() => {
    try {
      if (!window.sessionStorage.getItem("__sp_axe__")) {
        window.sessionStorage.setItem("__sp_axe__", "1");
        window.localStorage.clear();
      }
    } catch {
      /* ignore */
    }
  });
  await page.goto("/");
  await expect(page.getByTestId("clock")).toBeVisible();
  // 等入场动画结束，避免扫描到 opacity:0 的元素
  await page.waitForTimeout(900);
}

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  if (serious.length > 0) {
    console.log(
      `[axe:${label}]`,
      JSON.stringify(
        serious.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target) })),
        null,
        2,
      ),
    );
  }
  expect(serious, `${label} 存在严重无障碍问题`).toEqual([]);
}

test.describe("无障碍扫描", () => {
  test("首页（暗色）无 serious/critical 问题", async ({ page }) => {
    await fresh(page);
    await scan(page, "home-dark");
  });

  test("首页（亮色）无 serious/critical 问题", async ({ page }) => {
    await page.addInitScript((key) => {
      try {
        if (!window.sessionStorage.getItem("__sp_axe_light__")) {
          window.sessionStorage.setItem("__sp_axe_light__", "1");
          window.localStorage.clear();
          window.localStorage.setItem(
            key,
            JSON.stringify({ version: 1, theme: { mode: "light", accent: "#2F6FED" } }),
          );
        }
      } catch {
        /* ignore */
      }
    }, CONFIG_KEY);
    await page.goto("/");
    await expect(page.getByTestId("clock")).toBeVisible();
    await page.waitForTimeout(900);
    await scan(page, "home-light");
  });

  test("设置面板无 serious/critical 问题", async ({ page }) => {
    // 七个分类逐个跑一次 axe，并行执行时容易顶到全局 30s 上限（实测单跑约 20s，
    // 并行时被 CPU 抢占会超时），这里单独放宽
    test.setTimeout(90_000);
    await fresh(page);
    await page.getByTestId("settings-trigger").click();
    await expect(page.getByTestId("settings-done")).toBeVisible();
    await page.waitForTimeout(400);
    for (const tab of ["search", "appearance", "modules", "background", "privacy", "about"]) {
      await page.getByTestId(`settings-tab-${tab}`).click();
      await page.waitForTimeout(350);
      await scan(page, `settings-${tab}`);
    }
  });

  test("命令面板无 serious/critical 问题", async ({ page }) => {
    await fresh(page);
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("palette")).toBeVisible();
    await page.waitForTimeout(400);
    await scan(page, "palette");
  });

  test("快捷项编辑弹窗无 serious/critical 问题", async ({ page }) => {
    await fresh(page);
    // 快捷项编辑入口已在「设置 → 快捷跳转」里
    await page.getByTestId("settings-trigger").click();
    await page.getByTestId("settings-tab-shortcuts").click();
    await page.getByTestId("add-shortcut").click();
    await expect(page.getByTestId("shortcut-title")).toBeVisible();
    await page.waitForTimeout(400);
    await scan(page, "shortcut-editor");
  });
});
