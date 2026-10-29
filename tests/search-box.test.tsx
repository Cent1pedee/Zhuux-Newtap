import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./utils";
import { SearchBox } from "@/components/search-box";

function input() {
  return screen.getByTestId("search-input") as HTMLInputElement;
}

/** 建议列表只在输入框聚焦时展开，先聚焦再输入 */
function type(value: string) {
  const el = input();
  fireEvent.focus(el);
  fireEvent.change(el, { target: { value } });
  return el;
}

describe("搜索框：引擎切换", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("默认引擎为 Google，且表单有原生 GET 兜底", async () => {
    renderWithProviders(<SearchBox />);
    await waitFor(() => expect(screen.getByTestId("engine-name").textContent).toContain("Google"));
    const form = screen.getByTestId("search-form") as HTMLFormElement;
    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toContain("google.com");
    // 无 JS 时 input 的 name 决定查询参数
    expect(input().getAttribute("name")).toBe("q");
  });

  it("点击引擎按钮循环切换引擎", async () => {
    renderWithProviders(<SearchBox />);
    await waitFor(() => expect(screen.getByTestId("engine-name").textContent).toContain("Google"));
    fireEvent.click(screen.getByTestId("engine-button"));
    await waitFor(() => expect(screen.getByTestId("engine-name").textContent).not.toContain("Google"));
  });

  it("右键打开引擎菜单，可选择并关闭", async () => {
    renderWithProviders(<SearchBox />);
    fireEvent.contextMenu(screen.getByTestId("engine-button"));
    await waitFor(() => expect(screen.getByTestId("engine-menu")).toBeTruthy());
    fireEvent.click(screen.getByTestId("engine-option-baidu"));
    await waitFor(() => expect(screen.queryByTestId("engine-menu")).toBeNull());
    expect(screen.getByTestId("engine-name").textContent).toContain("百度");
  });
});

describe("搜索框：输入与建议", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("输入 / 展示快捷指令提示", async () => {
    renderWithProviders(<SearchBox />);
    type("/");
    await waitFor(() => expect(screen.getByTestId("suggestions")).toBeTruthy());
    expect(screen.getByTestId("suggestion-0").textContent).toContain("/");
  });

  it("输入 /g 关键词时提示命中 GitHub 指令", async () => {
    renderWithProviders(<SearchBox />);
    type("/g react");
    await waitFor(() =>
      expect(screen.getByTestId("suggestions").textContent).toContain("GitHub"),
    );
  });

  it("输入完整域名时提示「打开网址」", async () => {
    renderWithProviders(<SearchBox />);
    type("github.com");
    await waitFor(() => expect(screen.getByTestId("suggestions").textContent).toContain("打开网址"));
  });

  it("Esc 清空输入并收起建议", async () => {
    renderWithProviders(<SearchBox />);
    type("/");
    await waitFor(() => expect(screen.getByTestId("suggestions")).toBeTruthy());
    fireEvent.keyDown(input(), { key: "Escape" });
    await waitFor(() => expect(input().value).toBe(""));
  });

  it("清空按钮可用", async () => {
    renderWithProviders(<SearchBox />);
    fireEvent.change(input(), { target: { value: "hello" } });
    fireEvent.click(screen.getByTestId("search-clear"));
    await waitFor(() => expect(input().value).toBe(""));
  });
});

describe("搜索框：提交行为", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("空输入提交直接新标签打开当前引擎官网", async () => {
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    renderWithProviders(<SearchBox />);
    fireEvent.submit(screen.getByTestId("search-form"));
    // 空输入不是「拒绝」，而是「直接去那个站点」
    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1));
    const [url, target] = openSpy.mock.calls[0];
    expect(url).toMatch(/^https:\/\/www\.(google|bing|baidu)\.com\/?$/);
    expect(target).toBe("_blank");
    await waitFor(() => expect(screen.getByTestId("toast").textContent).toContain("已在新标签打开"));
    vi.unstubAllGlobals();
  });

  it("Shift+Enter 用新标签打开搜索地址", async () => {
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    renderWithProviders(<SearchBox />);
    fireEvent.change(input(), { target: { value: "hello world" } });
    fireEvent.keyDown(input(), { key: "Enter", shiftKey: true });
    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target] = openSpy.mock.calls[0];
    expect(url).toContain("google.com");
    expect(url).toContain("hello%20world");
    expect(target).toBe("_blank");
    vi.unstubAllGlobals();
  });

  it("回车与点搜索按钮都在新标签打开（不再跳走当前页）", async () => {
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    const hrefBefore = window.location.href;
    renderWithProviders(<SearchBox />);

    fireEvent.change(input(), { target: { value: "react 19" } });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0][0]).toContain("react%2019");
    expect(window.location.href).toBe(hrefBefore);

    fireEvent.click(screen.getByTestId("search-submit"));
    expect(openSpy).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it("Shift+Enter 对快捷指令解析到对应站点", async () => {
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    renderWithProviders(<SearchBox />);
    fireEvent.change(input(), { target: { value: "/g react" } });
    fireEvent.keyDown(input(), { key: "Enter", shiftKey: true });
    expect(openSpy.mock.calls[0][0]).toBe("https://github.com/search?q=react");
    vi.unstubAllGlobals();
  });
});
