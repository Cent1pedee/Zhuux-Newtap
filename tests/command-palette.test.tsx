import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./utils";
import { CommandPalette } from "@/components/command-palette";
import { CONFIG_KEY } from "@/lib/storage";

function readConfig() {
  return JSON.parse(window.localStorage.getItem(CONFIG_KEY) ?? "{}");
}

function items() {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="palette-item-"]'));
}

describe("命令面板", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("打开时渲染默认条目（搜索、快捷跳转、主题、背景、操作）", async () => {
    renderWithProviders(<CommandPalette open onOpenChange={() => {}} onOpenSettings={() => {}} />);
    await waitFor(() => expect(items().length).toBeGreaterThan(0));
    const text = screen.getByTestId("palette").textContent ?? "";
    expect(text).toContain("主题跟随系统");
    expect(text).toContain("每日壁纸");
    expect(text).toContain("打开设置");
  });

  it("输入关键词后出现网页搜索项与匹配的快捷项", async () => {
    renderWithProviders(<CommandPalette open onOpenChange={() => {}} onOpenSettings={() => {}} />);
    const input = screen.getByTestId("palette-input");
    fireEvent.change(input, { target: { value: "react" } });
    await waitFor(() => expect(screen.getByTestId("palette").textContent).toContain("搜索「react」"));
  });

  it("无匹配项时仍保留网页搜索兜底", async () => {
    renderWithProviders(<CommandPalette open onOpenChange={() => {}} onOpenSettings={() => {}} />);
    fireEvent.change(screen.getByTestId("palette-input"), { target: { value: "zzzz不存在的词" } });
    await waitFor(() => expect(items().length).toBe(1));
    expect(items()[0].textContent).toContain("搜索「zzzz不存在的词」");
  });

  it("点击「打开设置」触发 onOpenSettings", async () => {
    const onOpenSettings = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(
      <CommandPalette open onOpenChange={onOpenChange} onOpenSettings={onOpenSettings} />,
    );
    const target = await waitFor(() => {
      const node = items().find((el) => el.textContent?.includes("打开设置"));
      expect(node).toBeTruthy();
      return node!;
    });
    fireEvent.click(target);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() => expect(onOpenSettings).toHaveBeenCalled(), { timeout: 1500 });
  });

  it("点击「切换到亮色主题」改写配置", async () => {
    renderWithProviders(<CommandPalette open onOpenChange={() => {}} onOpenSettings={() => {}} />);
    const target = await waitFor(() => {
      const node = items().find((el) => el.textContent?.includes("切换到亮色主题"));
      expect(node).toBeTruthy();
      return node!;
    });
    fireEvent.click(target);
    await waitFor(() => expect(readConfig().theme.mode).toBe("light"), { timeout: 1500 });
  });

  it("点击背景项关闭每日壁纸", async () => {
    renderWithProviders(<CommandPalette open onOpenChange={() => {}} onOpenSettings={() => {}} />);
    const target = await waitFor(() => {
      const node = items().find((el) => el.textContent?.includes("关闭每日壁纸"));
      expect(node).toBeTruthy();
      return node!;
    });
    fireEvent.click(target);
    await waitFor(() => expect(readConfig().background.source).toBe("none"), { timeout: 1500 });
  });

  it("点击背景项把每日壁纸往前回溯一天", async () => {
    renderWithProviders(<CommandPalette open onOpenChange={() => {}} onOpenSettings={() => {}} />);
    const target = await waitFor(() => {
      const node = items().find((el) => el.textContent?.includes("回溯到"));
      expect(node).toBeTruthy();
      return node!;
    });
    fireEvent.click(target);
    await waitFor(() => expect(readConfig().background.offset).toBe(1), { timeout: 1500 });
  });

  it("方向键移动选中项，Enter 执行", async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <CommandPalette open onOpenChange={onOpenChange} onOpenSettings={() => {}} />,
    );
    const input = screen.getByTestId("palette-input");
    await waitFor(() => expect(items().length).toBeGreaterThan(1));
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Esc 关闭面板", async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <CommandPalette open onOpenChange={onOpenChange} onOpenSettings={() => {}} />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Cmd/Ctrl+K 切换开关", async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <CommandPalette open={false} onOpenChange={onOpenChange} onOpenSettings={() => {}} />,
    );
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("点击遮罩关闭面板", async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <CommandPalette open onOpenChange={onOpenChange} onOpenSettings={() => {}} />,
    );
    const palette = screen.getByTestId("palette");
    fireEvent.click(palette.firstElementChild as Element);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
