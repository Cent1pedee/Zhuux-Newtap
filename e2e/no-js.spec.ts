import { test, expect } from "@playwright/test";

/**
 * 无 JS 降级（PRD 6.3 / 8.5）：禁用 JavaScript 后，
 * 页面内容必须完整可读，搜索框必须能通过原生表单 GET 提交到引擎。
 */
test.describe("无 JS 环境", () => {
  test.use({ javaScriptEnabled: false });

  test("首屏内容完整，搜索框可原生提交", async ({ page, context }) => {
    const external: string[] = [];
    // 拦截外网导航，避免测试真的访问搜索引擎
    await context.route("**/*", (route) => {
      const url = route.request().url();
      if (url.startsWith("http://127.0.0.1:3100")) return route.continue();
      external.push(url);
      return route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>ok</body></html>" });
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    // 简洁布局的静态骨架：时间 / 搜索 / 一言 / Dock（时钟由 JS 接管后才走秒）
    await expect(page.getByTestId("clock")).toBeVisible();
    await expect(page.getByTestId("clock-text")).toHaveText("--:--");
    await expect(page.getByTestId("search-form")).toBeVisible();
    await expect(page.getByTestId("shortcut-dock")).toBeVisible();
    await expect(page.getByTestId("shortcut-total")).toHaveText("13");
    await expect(page.getByTestId("quote-card")).toBeVisible();
    await expect(page.getByTestId("wallpaper")).toBeAttached();
    // 展开态依赖 JS（点时间），无 JS 时不该出现方块与设置入口
    await expect(page.getByTestId("shortcut-grid")).toHaveCount(0);
    await expect(page.getByTestId("settings-trigger")).toHaveCount(0);
    // 便签仍收在经典布局里；天气模块已整体移除
    await expect(page.getByTestId("note-card-panel")).toHaveCount(0);

    // 表单具备原生提交所需的 action / method / name
    await expect(page.getByTestId("search-form")).toHaveAttribute("method", "get");
    await expect(page.getByTestId("search-form")).toHaveAttribute("action", /bing\.com/);
    await expect(page.getByTestId("search-input")).toHaveAttribute("name", "q");

    await page.getByTestId("search-input").fill("no js test");
    await page.getByTestId("search-submit").click();
    await page.waitForURL(/bing\.com/, { timeout: 15_000 });

    // 页面里的 favicon / 头像之类也会产生外部请求，这里只认导航到搜索页那一条
    const search = external.find((url) => url.includes("/search?"));
    expect(search).toBe("https://www.bing.com/search?q=no+js+test");
  });
});
