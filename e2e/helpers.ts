import { expect, type Page } from "@playwright/test";

/**
 * 打开完整设置。
 *
 * 简洁首页默认只有时间 / 搜索 / 一言 / Dock：先点时间进入展开态
 * （壁纸高斯模糊、快捷方块与右上角齿轮浮现），再点齿轮出二级菜单，
 * 最后选「常规」进入完整弹窗。
 * 经典布局顶栏本身就有「打开设置」，但同样先经过二级菜单。
 */
export async function openSettings(page: Page) {
  // 不能靠「有没有 settings-trigger」判断布局：菜单是动态加载的，
  // 首帧里经典布局的顶栏按钮也可能还没挂上，会被误判成简洁首页。
  const layout = await page.locator(".app-shell").getAttribute("data-layout");
  if (layout === "simple") {
    await page.getByTestId("clock").click();
    await expect(page.getByTestId("shortcut-grid")).toBeVisible();
  }
  await page.getByTestId("settings-trigger").click();
  await expect(page.getByTestId("settings-menu")).toBeVisible();
  await page.getByTestId("settings-menu-appearance").click();
  await expect(page.getByTestId("settings-done")).toBeVisible();
}

/**
 * 从二级菜单直达「隐私与数据 / 关于」独立弹窗。
 *
 * 这两类已从主设置面板的页签里移除，只保留菜单入口；
 * 主面板开着时齿轮被遮罩挡住，所以这个 helper 要从首页状态开始走。
 */
export async function openSettingsDialog(page: Page, target: "privacy" | "about") {
  const layout = await page.locator(".app-shell").getAttribute("data-layout");
  if (layout === "simple") {
    const grid = page.getByTestId("shortcut-grid");
    if (!(await grid.isVisible().catch(() => false))) {
      await page.getByTestId("clock").click();
      await expect(grid).toBeVisible();
    }
  }
  await page.getByTestId("settings-trigger").click();
  await expect(page.getByTestId("settings-menu")).toBeVisible();
  await page.getByTestId(`settings-menu-${target}`).click();
  await expect(page.getByTestId("settings-done")).toBeVisible();
}
