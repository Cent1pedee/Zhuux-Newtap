import { expect, type Page } from "@playwright/test";

/**
 * 打开完整设置。
 *
 * 齿轮现在直接打开主面板 —— 主面板本身就是完整的分类导航，
 * 再弹一层「去哪一页」的二级菜单属于重复导航，已移除。
 */
export async function openSettings(page: Page) {
  // 不能靠「有没有 settings-trigger」判断布局：经典布局的顶栏按钮是常驻的，
  // 简洁首页要先进展开态。
  const layout = await page.locator(".app-shell").getAttribute("data-layout");
  if (layout === "simple") {
    // 展开态可能已经开着（例如刚关掉弹窗又进来）：再点一次时钟会把它收起
    const grid = page.getByTestId("shortcut-grid");
    if (!(await grid.isVisible().catch(() => false))) {
      await page.getByTestId("clock").click();
      await expect(grid).toBeVisible();
    }
  }
  // 上一次弹窗的退出动画还会留一层遮罩，点齿轮会先撞在遮罩上（看起来像「没反应」）
  await expect(page.getByTestId("modal-overlay")).toHaveCount(0);
  await page.getByTestId("settings-trigger").click();
  await expect(page.getByTestId("settings-done")).toBeVisible();
}

/**
 * 从设置页脚打开「隐私与数据 / 关于」子弹窗。
 *
 * 这两类已从导航里移除，也不再走二级菜单；低频入口收在页脚，
 * 点开后在主面板之上叠一层更轻的弹窗，关闭回到原页签。
 */
export async function openSettingsDialog(page: Page, target: "privacy" | "about") {
  await openSettings(page);
  await page.getByTestId(`settings-open-${target}`).click();
  await expect(page.getByTestId(`${target}-done`)).toBeVisible();
}
