import { test, expect } from "@playwright/test";
import { openSettings } from "./helpers";

/**
 * 待办便签（PRD P2）。
 *
 * 首页默认是简洁模式，便签不再出现在首屏；这里显式切到经典布局并开启便签，
 * 验证模块自身可输入、自动保存、刷新后仍在，并可一键清空。
 */
test.describe("待办便签", () => {
  test.beforeEach(async ({ page }) => {
    // 只在本标签首次导航时清空：addInitScript 每次导航都会执行，
    // 不打卡会把「刷新后仍在」的断言自己清掉。
    await page.addInitScript(() => {
      try {
        if (window.sessionStorage.getItem("__note_e2e__")) return;
        window.sessionStorage.setItem("__note_e2e__", "1");
        window.localStorage.clear();
        window.localStorage.setItem(
          "startpage.config.v1",
          JSON.stringify({ home: { simple: false }, note: { enabled: true } }),
        );
      } catch {
        /* ignore */
      }
    });
    await page.goto("/");
    await expect(page.getByTestId("clock")).toBeVisible();
  });

  test("经典布局下可见，可输入并持久化到刷新后", async ({ page }) => {
    await expect(page.getByTestId("note-card")).toBeVisible();

    const input = page.getByTestId("note-input");
    await expect(input).toBeVisible();
    await input.fill("第一件事：写周报\n第二件事：跑测试");
    await expect(page.getByTestId("note-saved")).toBeVisible();

    // 等防抖落盘后再刷新
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.getByTestId("note-input")).toHaveValue("第一件事：写周报\n第二件事：跑测试");
  });

  test("关闭后便签卡整体退场，不留空盒子", async ({ page }) => {
    await expect(page.getByTestId("note-card")).toBeVisible();
    await expect(page.getByTestId("note-card-panel")).toBeVisible();
    await openSettings(page);
    await page.getByTestId("settings-tab-modules").click();
    await page.getByTestId("note-enable").click();
    await page.getByTestId("settings-done").click();
    await expect(page.getByTestId("settings-panel")).toBeHidden();

    await expect(page.getByTestId("note-card")).toHaveCount(0);
    // 便签有自己的卡，关掉后卡也一并退场，不留一个空盒子
    await expect(page.getByTestId("note-card-panel")).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId("note-card-panel")).toHaveCount(0);
  });

  test("清空按钮清掉内容且写回存储", async ({ page }) => {
    const input = page.getByTestId("note-input");
    await input.fill("待清除");
    await expect(page.getByTestId("note-saved")).toBeVisible();
    await page.waitForTimeout(500);
    await page.getByTestId("note-clear").click();
    await expect(input).toHaveValue("");
    await expect(page.getByTestId("note-clear")).toBeDisabled();

    await page.waitForTimeout(500);
    const stored = await page.evaluate(() => {
      const raw = window.localStorage.getItem("startpage.config.v1");
      return raw ? JSON.parse(raw).note : null;
    });
    expect(stored?.content).toBe("");
  });
});
