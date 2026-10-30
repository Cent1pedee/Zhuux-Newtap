import { describe, expect, it, vi, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { ConfigProvider, useConfig } from "@/lib/config-store";
import { CONFIG_KEY, saveConfig } from "@/lib/storage";
import { createDefaultConfig } from "@/config/defaults";

function Probe() {
  const { config, ready } = useConfig();
  return (
    <>
      <span data-testid="mode">{config.theme.mode}</span>
      <span data-testid="accent">{config.theme.accent}</span>
      <span data-testid="ready">{String(ready)}</span>
    </>
  );
}

function emitStorage(key: string | null, newValue: string | null) {
  act(() => {
    window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
  });
}

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("跨标签页配置同步", () => {
  it("其他标签页改了配置，本页跟着更新", async () => {
    window.localStorage.clear();
    render(
      <ConfigProvider>
        <Probe />
      </ConfigProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    expect(screen.getByTestId("mode").textContent).toBe("dark");

    // 模拟另一个标签页写入（storage 事件只会在「其他」标签触发）
    const next = createDefaultConfig();
    next.theme.mode = "light";
    next.theme.accent = "#7C5CFF";
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
    emitStorage(CONFIG_KEY, JSON.stringify(next));

    await waitFor(() => expect(screen.getByTestId("mode").textContent).toBe("light"));
    expect(screen.getByTestId("accent").textContent).toBe("#7C5CFF");
  });

  it("应用外部配置后不回写 localStorage（避免两标签互相触发）", async () => {
    window.localStorage.clear();
    render(
      <ConfigProvider>
        <Probe />
      </ConfigProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));
    // 等首轮的「上电写回」落完，再开始计数（否则统计到的是挂载时的写入）
    await act(async () => {
      await Promise.resolve();
    });

    // 先把外部写入准备好（这一步自己会写一次 localStorage，不能算在断言里）
    const next = createDefaultConfig();
    next.theme.mode = "light";
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(next));

    const spy = vi.spyOn(Storage.prototype, "setItem");
    emitStorage(CONFIG_KEY, JSON.stringify(next));

    await waitFor(() => expect(screen.getByTestId("mode").textContent).toBe("light"));
    await act(async () => {
      await Promise.resolve();
    });
    // safeStorage 会写一个探针键，这里只关心配置键
    const configWrites = spy.mock.calls.filter(([k]) => k === CONFIG_KEY);
    expect(configWrites).toHaveLength(0);
  });

  it("其他标签页清空配置时回到出厂值", async () => {
    window.localStorage.clear();
    const seeded = createDefaultConfig();
    seeded.theme.mode = "light";
    saveConfig(seeded);

    render(
      <ConfigProvider>
        <Probe />
      </ConfigProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("mode").textContent).toBe("light"));

    window.localStorage.clear();
    emitStorage(CONFIG_KEY, null);

    await waitFor(() => expect(screen.getByTestId("mode").textContent).toBe("dark"));
  });

  it("无关的 storage 键不触发配置更新", async () => {
    window.localStorage.clear();
    render(
      <ConfigProvider>
        <Probe />
      </ConfigProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toBe("true"));

    const other = createDefaultConfig();
    other.theme.mode = "light";
    emitStorage("startpage.wallpaper.daily", JSON.stringify(other));

    expect(screen.getByTestId("mode").textContent).toBe("dark");
  });
});
