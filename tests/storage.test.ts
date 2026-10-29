import { describe, expect, it, beforeEach } from "vitest";
import { CONFIG_KEY, clearAllData, loadConfig, mergeConfig, saveConfig } from "@/lib/storage";
import { createDefaultConfig } from "@/config/defaults";

describe("配置读写", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("无存储时返回默认配置", () => {
    const config = loadConfig();
    expect(config.version).toBe(1);
    expect(config.engineId).toBe("google");
    expect(config.theme.accent).toBe("#2F6FED");
  });

  it("保存后可读回", () => {
    const config = createDefaultConfig();
    config.theme.mode = "light";
    config.clock.showSeconds = true;
    saveConfig(config);
    const loaded = loadConfig();
    expect(loaded.theme.mode).toBe("light");
    expect(loaded.clock.showSeconds).toBe(true);
  });

  it("损坏的 JSON 回退默认值且不抛错", () => {
    window.localStorage.setItem(CONFIG_KEY, "{ not json");
    expect(() => loadConfig()).not.toThrow();
    expect(loadConfig().engineId).toBe("google");
  });

  it("部分字段缺失时用默认值补齐", () => {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify({ theme: { mode: "light" } }));
    const loaded = loadConfig();
    expect(loaded.theme.mode).toBe("light");
    // 缺失字段保留默认
    expect(loaded.theme.accent).toBe("#2F6FED");
    expect(loaded.groups.length).toBeGreaterThan(0);
  });
});

describe("mergeConfig 导入防御", () => {
  const base = createDefaultConfig();

  it("非对象输入原样返回 base", () => {
    expect(mergeConfig(base, null)).toEqual(base);
    expect(mergeConfig(base, "x")).toEqual(base);
    expect(mergeConfig(base, 42)).toEqual(base);
  });

  it("忽略类型不符的字段", () => {
    const merged = mergeConfig(base, { theme: { mode: "light", accent: 123 } });
    expect(merged.theme.mode).toBe("light");
    expect(merged.theme.accent).toBe("#2F6FED");
  });

  it("不认识的字段被丢弃", () => {
    const merged = mergeConfig(base, { hacker: true }) as unknown as Record<string, unknown>;
    expect(merged.hacker).toBeUndefined();
  });

  it("数组整体替换", () => {
    const groups = [{ id: "g1", name: "测试", items: [] }];
    const merged = mergeConfig(base, { groups });
    expect(merged.groups).toHaveLength(1);
    expect(merged.groups[0].name).toBe("测试");
  });

  it("不修改传入的 base", () => {
    const snapshot = JSON.stringify(base);
    mergeConfig(base, { theme: { mode: "light" } });
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});

describe("clearAllData", () => {
  it("清空 localStorage 配置", async () => {
    saveConfig(createDefaultConfig());
    expect(window.localStorage.getItem(CONFIG_KEY)).not.toBeNull();
    await clearAllData();
    expect(window.localStorage.getItem(CONFIG_KEY)).toBeNull();
  });
});
