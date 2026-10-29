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

    // 五个 P0 模块的静态骨架都在（时钟此刻为 --:--，由 JS 接管后才走秒）
    await expect(page.getByTestId("search-form")).toBeVisible();
    await expect(page.getByTestId("shortcut-total")).toHaveText("12");
    await expect(page.getByTestId("quote-card")).toBeVisible();
    await expect(page.getByTestId("wallpaper")).toBeAttached();

    // 表单具备原生提交所需的 action / method / name
    await expect(page.getByTestId("search-form")).toHaveAttribute("method", "get");
    await expect(page.getByTestId("search-form")).toHaveAttribute("action", /google\.com/);
    await expect(page.getByTestId("search-input")).toHaveAttribute("name", "q");

    await page.getByTestId("search-input").fill("no js test");
    await page.getByTestId("search-submit").click();
    await page.waitForURL(/google\.com/, { timeout: 15_000 });

    // 页面里的 favicon / 头像之类也会产生外部请求，这里只认导航到搜索页那一条
    const search = external.find((url) => url.includes("/search?"));
    expect(search).toBe("https://www.google.com/search?q=no+js+test");
  });
});
