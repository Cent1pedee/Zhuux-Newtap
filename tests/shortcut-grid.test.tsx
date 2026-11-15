import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "./utils";
import { ShortcutGrid } from "@/components/shortcut-grid";
import { CONFIG_KEY } from "@/lib/storage";

describe("快捷方块网格", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("展平默认分组，渲染 12 个站点方块 + 1 个添加方块", () => {
    renderWithProviders(<ShortcutGrid onManage={() => {}} />);
    const grid = screen.getByTestId("shortcut-grid");
    expect(grid.querySelectorAll(".shortcut-tile")).toHaveLength(13);
    const github = screen.getByTestId("shortcut-grid-sc-github");
    expect(github.getAttribute("href")).toBe("https://github.com");
    expect(github.getAttribute("target")).toBe("_blank");
    expect(github.textContent).toContain("GitHub");
    expect(screen.getByTestId("shortcut-add-tile").textContent).toContain("添加");
    // 不再有玻璃托板与头部标题栏：方块直接落在壁纸上
    expect(screen.queryByTestId("shortcut-shelf")).toBeNull();
    expect(screen.queryByTestId("shortcut-manage")).toBeNull();
  });

  it("添加方块触发管理回调", () => {
    const onManage = vi.fn();
    renderWithProviders(<ShortcutGrid onManage={onManage} />);
    fireEvent.click(screen.getByTestId("shortcut-add-tile"));
    expect(onManage).toHaveBeenCalledTimes(1);
  });

  it("关闭图标抓取后每个方块都有首字母兜底，不会出现空白方块", () => {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify({ icons: { autoFetch: false } }));
    renderWithProviders(<ShortcutGrid onManage={() => {}} />);
    expect(screen.getAllByTestId("icon-fallback")).toHaveLength(12);
  });
});
