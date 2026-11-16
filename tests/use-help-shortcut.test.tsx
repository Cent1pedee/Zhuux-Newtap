import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { useHelpShortcut } from "@/lib/use-help-shortcut";

/** 只测监听本身：组件不渲染任何东西，行为由 page.tsx 消费 */
function Probe({ onOpen, enabled = true }: { onOpen: () => void; enabled?: boolean }) {
  useHelpShortcut(onOpen, enabled);
  return null;
}

describe("? 快捷键监听", () => {
  it("按 ? 触发打开", () => {
    const onOpen = vi.fn();
    render(<Probe onOpen={onOpen} />);
    fireEvent.keyDown(window, { key: "?" });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("输入框里按 ? 不触发（问号是正文）", () => {
    const onOpen = vi.fn();
    render(<Probe onOpen={onOpen} />);
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "?" });
    expect(onOpen).not.toHaveBeenCalled();
    input.remove();
  });

  it("带修饰键不算快捷键", () => {
    const onOpen = vi.fn();
    render(<Probe onOpen={onOpen} />);
    fireEvent.keyDown(window, { key: "?", metaKey: true });
    fireEvent.keyDown(window, { key: "?", ctrlKey: true });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("enabled=false 时（已经打开）不再重复触发", () => {
    const onOpen = vi.fn();
    render(<Probe onOpen={onOpen} enabled={false} />);
    fireEvent.keyDown(window, { key: "?" });
    expect(onOpen).not.toHaveBeenCalled();
  });
});
