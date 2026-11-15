import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WidgetBoundary } from "@/components/widget-boundary";

let shouldThrow = true;

function Bomb() {
  if (shouldThrow) throw new Error("boom");
  return <p>恢复了</p>;
}

describe("WidgetBoundary", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    shouldThrow = true;
    // React 会把捕获到的错误再打印一次，测试里静音
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("子模块抛错时只降级自己，兄弟节点仍在", () => {
    render(
      <div>
        <span>兄弟节点</span>
        <WidgetBoundary label="天气">
          <Bomb />
        </WidgetBoundary>
      </div>,
    );

    expect(screen.getByText("兄弟节点")).toBeTruthy();
    expect(screen.getByTestId("widget-fallback")).toBeTruthy();
    expect(screen.getByText("天气暂时不可用")).toBeTruthy();
    expect(screen.queryByText("恢复了")).toBeNull();
  });

  it("点重试后重新渲染子模块", () => {
    render(
      <WidgetBoundary label="天气">
        <Bomb />
      </WidgetBoundary>,
    );

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    expect(screen.getByText("恢复了")).toBeTruthy();
    expect(screen.queryByTestId("widget-fallback")).toBeNull();
  });

  it("silent 模式不渲染占位", () => {
    render(
      <WidgetBoundary label="设置" silent>
        <Bomb />
      </WidgetBoundary>,
    );

    expect(screen.queryByTestId("widget-fallback")).toBeNull();
    expect(screen.queryByText("设置暂时不可用")).toBeNull();
  });
});
