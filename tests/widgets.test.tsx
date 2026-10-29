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
    renderWithProviders(<Clock />);
    await waitFor(() => expect(screen.getByTestId("clock-text").textContent).toMatch(/\d{2}:\d{2}/));
    await waitFor(() => expect(screen.getByTestId("greeting").textContent?.length).toBeGreaterThan(0));
    expect(screen.getByTestId("date-label").textContent).toBe(dateLabelOf(new Date()));
  });

  it("问候语与当前时段一致", async () => {
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

type StoredConfig = {
  weather: { province?: string; city?: string; source?: string; lat?: number; lon?: number; unit?: string };
};
function readConfig(): StoredConfig {
  return JSON.parse(window.localStorage.getItem(CONFIG_KEY) ?? "{}") as StoredConfig;
}

describe("天气", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("显式关闭时不渲染", async () => {
    // 天气现在默认开启（天气是首屏信息的一部分，不该让人先进设置才看到）
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify({ weather: { enabled: false } }));
    const { Weather } = await import("@/components/weather");
    const { container } = renderWithProviders(<Weather />);
    await waitFor(() => expect(container.querySelector('[data-testid="weather"]')).toBeNull());
  });

  it("默认开启：没有坐标时自动尝试定位，并给出定位入口", async () => {
    const { Weather } = await import("@/components/weather");
    renderWithProviders(<Weather />);
    await waitFor(() => expect(screen.getByTestId("weather-locate")).toBeTruthy());
  });

  it("可以手动选省份与城市，写入配置后按城市坐标取数", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ current: { temperature_2m: 18, weather_code: 1 } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const { Weather } = await import("@/components/weather");
    renderWithProviders(<Weather />);
    fireEvent.click(await screen.findByTestId("weather-pick-open"));
    fireEvent.change(await screen.findByTestId("weather-province"), { target: { value: "上海市" } });
    /*
     * 选省份只是切城市列表，不写库 —— 否则一选省份就被强行改成该省第一个城市。
     * 写库发生在「选城市」这一步，且面板不能收起（这里的断言就是防回归）。
     */
    expect(screen.getByTestId("weather-city-select")).toBeTruthy();
    expect(readConfig().weather.province).toBe("");
    fireEvent.change(screen.getByTestId("weather-city-select"), { target: { value: "上海" } });
    // 全套件并行跑时 CPU 吃紧，React 的写回 effect 可能被推迟到默认 1s 之外
    await waitFor(() => expect(readConfig().weather.province).toBe("上海市"), { timeout: 4000 });
    expect(readConfig().weather.city).toBe("上海");
    expect(readConfig().weather.source).toBe("manual");
    expect(readConfig().weather.lat).toBeCloseTo(31.23);
  });

  it("有坐标时请求天气并展示温度", async () => {
    window.localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({
        weather: { enabled: true, lat: 31.23, lon: 121.47, province: "上海市", city: "上海", unit: "c", source: "manual" },
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ current: { temperature_2m: 21.5, weather_code: 0 } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const { Weather } = await import("@/components/weather");
    renderWithProviders(<Weather />);
    await waitFor(() => expect(screen.getByTestId("weather").textContent).toContain("°C"));
    expect(screen.getByTestId("weather").textContent).toContain("上海");
  });

  it("请求失败时展示重试按钮", async () => {
    window.localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({
        weather: { enabled: true, lat: 31.23, lon: 121.47, province: "上海市", city: "上海", source: "manual" },
      }),
    );
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    const { Weather } = await import("@/components/weather");
    renderWithProviders(<Weather />);
    await waitFor(() => expect(screen.getByTestId("weather-retry")).toBeTruthy());
  });
});
