import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { ShortcutHelp } from "@/components/shortcut-help";
import { renderWithProviders } from "./utils";

describe("快捷键帮助", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("列出主要快捷键，关闭按钮可用", () => {
    const onClose = vi.fn();
    renderWithProviders(<ShortcutHelp open onClose={onClose} />);
    expect(screen.getByTestId("shortcut-help-list").textContent).toContain("命令面板");
    expect(screen.getByTestId("shortcut-help-list").textContent).toContain("第 1–9 个快捷项");
    fireEvent.click(screen.getByTestId("shortcut-help-close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("弹窗本身不再注册 ? 监听（已上移到页面层，见 use-help-shortcut）", () => {
    const onOpen = vi.fn();
    renderWithProviders(<ShortcutHelp open={false} onClose={() => {}} />);
    fireEvent.keyDown(window, { key: "?" });
    expect(onOpen).not.toHaveBeenCalled();
  });
});
