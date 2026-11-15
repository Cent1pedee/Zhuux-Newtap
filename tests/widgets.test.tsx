import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./utils";
import { Clock } from "@/components/clock";
import { dateLabelOf, greetingAt } from "@/lib/greeting";
import { CONFIG_KEY } from "@/lib/storage";

describe("时钟与问候", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("渲染时钟、问候与日期", async () => {
    // 简洁首页默认不显示问候语；组件本身的问候能力仍需覆盖
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify({ greeting: { show: true } }));
    renderWithProviders(<Clock />);
    await waitFor(() => expect(screen.getByTestId("clock-text").textContent).toMatch(/\d{2}:\d{2}/));
    await waitFor(() => expect(screen.getByTestId("greeting").textContent?.length).toBeGreaterThan(0));
    expect(screen.getByTestId("date-label").textContent).toBe(dateLabelOf(new Date()));
  });

  it("问候语与当前时段一致", async () => {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify({ greeting: { show: true } }));
    renderWithProviders(<Clock />);
    await waitFor(() => expect(screen.getByTestId("greeting").textContent).toBe(greetingAt(new Date())));
  });

  it("自定义问候语优先生效", async () => {
    window.localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({ greeting: { show: true, custom: "开工啦" } }),
    );
    renderWithProviders(<Clock />);
    await waitFor(() => expect(screen.getByTestId("greeting").textContent).toBe("开工啦"));
  });

  it("关闭时钟后不渲染时钟数字", async () => {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify({ clock: { show: false } }));
    renderWithProviders(<Clock />);
    await waitFor(() => expect(screen.queryByTestId("clock-text")).toBeNull());
  });

  it("点击时间触发展开，并反映展开状态", () => {
    const onActivate = vi.fn();
    renderWithProviders(<Clock onActivate={onActivate} active />);
    const clock = screen.getByTestId("clock");
    const trigger = clock.closest("button");
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(trigger?.getAttribute("aria-controls")).toBe("home-reveal");
    fireEvent.click(clock);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("右键时间同样触发展开（与左键同一个开关）", () => {
    const onActivate = vi.fn();
    renderWithProviders(<Clock onActivate={onActivate} />);
    const clock = screen.getByTestId("clock");
    fireEvent.contextMenu(clock);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("开启秒后时钟包含秒位", async () => {
    window.localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({ clock: { show: true, showSeconds: true, flip: false } }),
    );
    renderWithProviders(<Clock />);
    await waitFor(() => expect((screen.getByTestId("clock-text").textContent ?? "").split(":").length).toBe(3));
  });
});

/** 预置配置（ConfigProvider 挂载时从 localStorage 读取） */
function seedConfig(patch: Record<string, unknown>) {
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(patch));
}

describe("背景", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("关闭每日壁纸时只渲染渐变兜底，不发任何网络请求", async () => {
    seedConfig({ background: { source: "none" } });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { Wallpaper } = await import("@/components/wallpaper");
    renderWithProviders(<Wallpaper />);
    await waitFor(() => expect(screen.getByTestId("wallpaper")).toBeTruthy());
    expect(screen.getByTestId("wallpaper").getAttribute("data-bg-source")).toBe("none");
    expect(screen.getByTestId("wallpaper-fallback")).toBeTruthy();
    expect(screen.queryByTestId("wallpaper-image")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("每日壁纸取回后渲染图片，并把元数据写入 data-bg-source", async () => {
    seedConfig({ background: { source: "edge", offset: 0 } });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          url: "https://www.bing.com/th?id=OHR.Test_1920x1080.jpg",
          copyright: "测试图",
          copyright_link: "https://www.bing.com",
          start_date: "20261028",
        }),
      })) as unknown as typeof fetch,
    );
    const { Wallpaper } = await import("@/components/wallpaper");
    renderWithProviders(<Wallpaper />);
    await waitFor(() => expect(screen.getByTestId("wallpaper").getAttribute("data-bg-source")).toBe("edge"));
    const img = await screen.findByTestId("wallpaper-image");
    expect(img.getAttribute("src")).toContain("th?id=OHR.Test");
    expect(screen.queryByTestId("wallpaper-fallback")).toBeNull();
  });

  it("自定义图片加载失败时降级为渐变", async () => {
    seedConfig({
      background: { source: "none" },
      wallpaper: { source: "local", value: "data:image/png;base64,AAAA" },
    });
    const { Wallpaper } = await import("@/components/wallpaper");
    renderWithProviders(<Wallpaper />);
    const img = await screen.findByTestId("wallpaper-image");
    fireEvent.error(img);
    await waitFor(() => expect(screen.getByTestId("wallpaper-fallback")).toBeTruthy());
  });
});

