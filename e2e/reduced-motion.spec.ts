import { test, expect } from "@playwright/test";

/**
 * reduced-motion（PRD 5.4 / 8.5）：系统偏好为 reduce 时，
 * 入场动画时长必须为 0（元素直接呈现），且一言的入场 animation 被关闭。
 */
test.describe("系统减少动效", () => {
  test.use({ reducedMotion: "reduce" });

  test("入场动画归零，氛围光停止漂移", async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
      } catch {
        /* ignore */
      }
    });
    await page.goto("/");
    await expect(page.getByTestId("clock")).toBeVisible();

    // 首帧即完全可见（无 150-600ms 错峰淡入等待）：四个入场模块 opacity 都为 1、无位移
    const entrance = await page.evaluate(() =>
      ["clock", "search", "grid", "quote"].map((key) => {
        const el = document.querySelector(`[data-entrance="${key}"]`) as HTMLElement | null;
        if (!el) return { key, opacity: null, transform: null };
        const style = getComputedStyle(el);
        return { key, opacity: Number(style.opacity), transform: style.transform };
      }),
    );
    for (const item of entrance) {
      expect(item.opacity, `${item.key} 未立即呈现`).toBe(1);
      expect(item.transform === "none" || item.transform === "matrix(1, 0, 0, 1, 0, 0)", `${item.key} 仍有位移`).toBe(true);
    }

    // 一言的入场 CSS animation 被 reduce 规则关掉（否则它会在 600ms 后重新把 opacity 拉起来）
    const quoteAnim = await page
      .getByTestId("quote-section")
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(quoteAnim).toBe("none");

    // 逐字动画降级：一言文本是完整一句话，而非被拆成多个 span
    const spans = await page.getByTestId("quote-text").evaluate((el) => el.querySelectorAll("span").length);
    expect(spans).toBe(0);
  });
});
