import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { ShortcutHelp } from "@/components/shortcut-help";
import { renderWithProviders } from "./utils";

describe("快捷键帮助", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("按 ? 打开", () => {
    const onOpen = vi.fn();
    renderWithProviders(<ShortcutHelp open={false} onOpen={onOpen} onClose={() => {}} />);
    fireEvent.keyDown(window, { key: "?" });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("输入框里按 ? 不触发", () => {
    const onOpen = vi.fn();
    renderWithProviders(<ShortcutHelp open={false} onOpen={onOpen} onClose={() => {}} />);
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "?" });
    expect(onOpen).not.toHaveBeenCalled();
    input.remove();
  });

  it("已打开时不再重复触发", () => {
    const onOpen = vi.fn();
    renderWithProviders(<ShortcutHelp open onOpen={onOpen} onClose={() => {}} />);
    fireEvent.keyDown(window, { key: "?" });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("列出主要快捷键，关闭按钮可用", () => {
    const onClose = vi.fn();
    renderWithProviders(<ShortcutHelp open onOpen={() => {}} onClose={onClose} />);
    expect(screen.getByTestId("shortcut-help-list").textContent).toContain("命令面板");
    expect(screen.getByTestId("shortcut-help-list").textContent).toContain("第 1–9 个快捷项");
    fireEvent.click(screen.getByTestId("shortcut-help-close"));
    expect(onClose).toHaveBeenCalled();
  });
});
