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

  it("默认引擎为 Bing，且表单有原生 GET 兜底", async () => {
    renderWithProviders(<SearchBox />);
    await waitFor(() => expect(screen.getByTestId("engine-name").textContent).toContain("Bing"));
    const form = screen.getByTestId("search-form") as HTMLFormElement;
    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toContain("bing.com");
    // 无 JS 时 input 的 name 决定查询参数
    expect(input().getAttribute("name")).toBe("q");
  });

  it("点击引擎按钮弹出引擎列表，而不是直接切到下一个", async () => {
    renderWithProviders(<SearchBox />);
    await waitFor(() => expect(screen.getByTestId("engine-name").textContent).toContain("Bing"));
    fireEvent.click(screen.getByTestId("engine-button"));
    await waitFor(() => expect(screen.getByTestId("engine-menu")).toBeTruthy());
    // 只是把列表摊开，当前引擎不变
    expect(screen.getByTestId("engine-name").textContent).toContain("Bing");
    expect(screen.getByTestId("engine-option-bing").getAttribute("aria-checked")).toBe("true");
    // 再点一次收起
    fireEvent.click(screen.getByTestId("engine-button"));
    await waitFor(() => expect(screen.queryByTestId("engine-menu")).toBeNull());
  });

  it("在菜单里选定引擎后写回配置并收起菜单", async () => {
    renderWithProviders(<SearchBox />);
    fireEvent.click(screen.getByTestId("engine-button"));
    await waitFor(() => expect(screen.getByTestId("engine-option-baidu")).toBeTruthy());
    fireEvent.click(screen.getByTestId("engine-option-baidu"));
    await waitFor(() => expect(screen.queryByTestId("engine-menu")).toBeNull());
    expect(screen.getByTestId("engine-name").textContent).toContain("百度");
  });

  it("右键同样打开引擎菜单", async () => {
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
    expect(url).toContain("bing.com");
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

describe("搜索框：聚焦态", () => {
  /*
   * 焦点在输入框和胶囊里的其它控件之间移动时，面板不能闪回「未聚焦」：
   * 引擎徽标与提交键本身是「聚焦才可见」的，一退回就等于把它们自己在
   * 被点的那一瞬藏起来 —— 用户看到的是「点了一下没反应」。
   */
  it("焦点移进胶囊内的控件时不收起，真正离开才收起", async () => {
    renderWithProviders(<SearchBox />);
    const shell = screen.getByTestId("search-shell");

    fireEvent.focus(input());
    await waitFor(() => expect(shell.getAttribute("data-focused")).toBe("true"));

    // 鼠标按下提交键：先 blur，焦点随后落到按钮上
    fireEvent.blur(input());
    screen.getByTestId("search-submit").focus();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(shell.getAttribute("data-focused")).toBe("true");

    // 焦点真的离开面板（到 body）才允许收起：回到输入框再失焦出去
    fireEvent.focus(input());
    await waitFor(() => expect(shell.getAttribute("data-focused")).toBe("true"));
    fireEvent.blur(input());
    (document.activeElement as HTMLElement | null)?.blur?.();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(shell.getAttribute("data-focused")).toBe("false");
  });
});

describe("搜索框：最近搜索", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("提交后记入历史，清空输入时展示", async () => {
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    renderWithProviders(<SearchBox />);

    const el = input();
    fireEvent.focus(el);
    fireEvent.change(el, { target: { value: "react 19" } });
    fireEvent.keyDown(el, { key: "Enter" });
    expect(openSpy).toHaveBeenCalledTimes(1);

    // 清空输入 → 历史面板出现（仍处于聚焦态）
    fireEvent.change(el, { target: { value: "" } });
    await waitFor(() => expect(screen.getByTestId("search-history")).toBeTruthy());
    expect(screen.getByTestId("search-history").textContent).toContain("react 19");
    vi.unstubAllGlobals();
  });

  it("历史展开时打开引擎菜单，历史让位（同一时刻只留一层下拉）", async () => {
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    renderWithProviders(<SearchBox />);

    const el = input();
    fireEvent.focus(el);
    fireEvent.change(el, { target: { value: "vite" } });
    fireEvent.keyDown(el, { key: "Enter" });
    fireEvent.change(el, { target: { value: "" } });
    await waitFor(() => expect(screen.getByTestId("search-history")).toBeTruthy());

    fireEvent.click(screen.getByTestId("engine-button"));
    await waitFor(() => expect(screen.getByTestId("engine-menu")).toBeTruthy());
    // 历史开始退场；菜单是此刻唯一的下拉层，不会被历史盖住
    await waitFor(() => expect(screen.queryByTestId("search-history")).toBeNull());
    vi.unstubAllGlobals();
  });

  it("点历史条目直接搜索，且不会污染成指令", async () => {
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    renderWithProviders(<SearchBox />);

    const el = input();
    fireEvent.focus(el);
    fireEvent.change(el, { target: { value: "vite" } });
    fireEvent.keyDown(el, { key: "Enter" });
    fireEvent.change(el, { target: { value: "" } });

    await waitFor(() => expect(screen.getByTestId("search-history")).toBeTruthy());
    fireEvent.click(screen.getByText("vite"));
    expect(openSpy.mock.calls.at(-1)?.[0]).toContain("vite");
    vi.unstubAllGlobals();
  });

  it("可删除单条与清除全部", async () => {
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    renderWithProviders(<SearchBox />);

    const el = input();
    fireEvent.focus(el);
    fireEvent.change(el, { target: { value: "alpha" } });
    fireEvent.keyDown(el, { key: "Enter" });
    fireEvent.change(el, { target: { value: "beta" } });
    fireEvent.keyDown(el, { key: "Enter" });
    fireEvent.change(el, { target: { value: "" } });

    await waitFor(() => expect(screen.getAllByTestId("search-history-remove")).toHaveLength(2));
    fireEvent.click(screen.getAllByTestId("search-history-remove")[0]);
    await waitFor(() => expect(screen.getAllByTestId("search-history-remove")).toHaveLength(1));

    fireEvent.click(screen.getByTestId("search-history-clear"));
    await waitFor(() => expect(screen.queryByTestId("search-history")).toBeNull());
    vi.unstubAllGlobals();
  });
});
