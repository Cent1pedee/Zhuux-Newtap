import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./utils";
import { DailyQuote } from "@/components/daily-quote";
import { CONFIG_KEY } from "@/lib/storage";
import { QUOTES } from "@/lib/quotes";

const TEXTS = new Set(QUOTES.map((q) => q.text));

/** 把一言来源锁成本地库（默认已改为远程 API） */
function seedLocal() {
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify({ quote: { show: true, source: "local", category: "all" } }));
}

describe("每日一言", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("本地源时零网络请求", async () => {
    seedLocal();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    renderWithProviders(<DailyQuote />);
    await waitFor(() => expect(TEXTS.has(screen.getByTestId("quote-text").textContent!.trim())).toBe(true));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("默认走远程 API，成功后展示接口返回的句子", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ hitokoto: "远程来的一句话", from: "测试来源" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    renderWithProviders(<DailyQuote />);
    await waitFor(() => expect(screen.getByTestId("quote-text").textContent).toContain("远程来的一句话"));
    expect(fetchSpy).toHaveBeenCalled();
    expect(screen.getByTestId("quote-from").textContent).toContain("测试来源");
  });

  it("远程失败时静默回退内置语录库", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    renderWithProviders(<DailyQuote />);
    await waitFor(() => expect(TEXTS.has(screen.getByTestId("quote-text").textContent!.trim())).toBe(true));
  });

  it("点击正文即换一条（没有刷新按钮）", async () => {
    seedLocal();
    renderWithProviders(<DailyQuote />);
    await waitFor(() => expect(screen.getByTestId("quote-body")).toBeTruthy());
    const before = screen.getByTestId("quote-text").textContent;
    fireEvent.click(screen.getByTestId("quote-body"));
    await waitFor(() => expect(screen.getByTestId("quote-text").textContent).not.toBe(before));
    expect(screen.queryByTestId("quote-refresh")).toBeNull();
  });

  it("不再显示来源标签与分类菜单", async () => {
    seedLocal();
    renderWithProviders(<DailyQuote />);
    await waitFor(() => expect(screen.getByTestId("quote-card")).toBeTruthy());
    expect(screen.queryByTestId("quote-source")).toBeNull();
    expect(screen.queryByTestId("quote-category-button")).toBeNull();
    expect(screen.queryByTestId("quote-category-menu")).toBeNull();
  });

  it("出处始终有内容", async () => {
    seedLocal();
    renderWithProviders(<DailyQuote />);
    await waitFor(() => expect(screen.getByTestId("quote-from").textContent).toContain("—"));
  });

  it("聚焦输入框时整段渐隐，失焦后复原", async () => {
    seedLocal();
    renderWithProviders(<DailyQuote />);
    const section = await screen.findByTestId("quote-section");
    expect(section.getAttribute("data-dimmed")).toBe("false");

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    await waitFor(() => expect(section.getAttribute("data-dimmed")).toBe("true"));

    input.blur();
    await waitFor(() => expect(section.getAttribute("data-dimmed")).toBe("false"));
    input.remove();
  });
});
