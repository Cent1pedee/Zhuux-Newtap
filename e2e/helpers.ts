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

/**
 * 反复读同一个快照，直到连续两次完全一致再返回。
 *
 * 为什么需要：CI runner 比本地慢 2–3 倍（同一套用例本地 1m12s、CI 3m33s）。
 * `waitForTimeout(280)` 在本地够用，在 CI 上会落在过渡中间 ——
 * 滑块还差 1px、toast 还在缩放，断言逐帧值就红。
 * 等「值不再变化」比加大 sleep 稳，也比放宽阈值诚实。
 */
export async function readSettled<T>(
  read: () => Promise<T>,
  { step = 80, tries = 30 }: { step?: number; tries?: number } = {},
): Promise<T> {
  let prev = await read();
  for (let i = 0; i < tries; i++) {
    await new Promise((resolve) => setTimeout(resolve, step));
    const next = await read();
    if (JSON.stringify(next) === JSON.stringify(prev)) return next;
    prev = next;
  }
  return prev;
}

/**
 * 等到某个子树里没有正在运行的 CSS 动画/过渡。
 *
 * 比「两次采样一致」更硬：慢机上过渡会持续几百毫秒，而连续两次采样可能
 * 都落在同一条缓动的同一段（页面被节流时甚至会冻在中间值），
 * 直接问浏览器「动画跑完没有」才是准的。
 */
export async function settleAnimations(page: Page, selector: string) {
  await page
    .waitForFunction(
      (sel) => {
        const root = document.querySelector(sel);
        if (!root) return true;
        return root.getAnimations({ subtree: true }).every((a) => a.playState !== "running");
      },
      selector,
      { timeout: 5_000 },
    )
    .catch(() => {
      /* 拿不到动画列表时退回直接读取，由断言报数值 */
    });
}
