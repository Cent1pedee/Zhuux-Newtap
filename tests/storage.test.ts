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
    expect(config.engineId).toBe("bing");
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
    expect(loadConfig().engineId).toBe("bing");
  });

  it("部分字段缺失时用默认值补齐", () => {
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify({ theme: { mode: "light" } }));
    const loaded = loadConfig();
    expect(loaded.theme.mode).toBe("light");
    // 缺失字段保留默认
    expect(loaded.theme.accent).toBe("#2F6FED");
    expect(loaded.groups.length).toBeGreaterThan(0);
    // 新默认：13 个可访问站点，含 nav.zhuux.cn
    expect(loaded.groups[0].items).toHaveLength(13);
    expect(loaded.groups[0].items[0].url).toBe("https://nav.zhuux.cn");
  });

  it("一次性迁移：旧默认快捷项换成新默认", () => {
    window.localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({
        groups: [
          {
            id: "grp-main",
            name: "快捷跳转",
            items: [
              { id: "sc-nas", title: "NAS", url: "http://192.168.1.10:5000" },
              { id: "sc-grafana", title: "Grafana", url: "http://192.168.1.10:3000" },
              { id: "sc-uptime", title: "Uptime", url: "http://192.168.1.10:3001" },
              { id: "sc-jellyfin", title: "Jellyfin", url: "http://192.168.1.10:8096" },
              { id: "sc-github", title: "GitHub", url: "https://github.com" },
              { id: "sc-bili", title: "哔哩哔哩", url: "https://www.bilibili.com" },
              { id: "sc-zhihu", title: "知乎", url: "https://www.zhihu.com" },
              { id: "sc-weibo", title: "微博", url: "https://weibo.com" },
              { id: "sc-mdn", title: "MDN", url: "https://developer.mozilla.org" },
              { id: "sc-npm", title: "npm", url: "https://www.npmjs.com" },
              { id: "sc-vercel", title: "Vercel", url: "https://vercel.com" },
              { id: "sc-canIuse", title: "Can I use", url: "https://caniuse.com" },
            ],
          },
        ],
      }),
    );

    const loaded = loadConfig();
    expect(loaded.groups[0].items).toHaveLength(13);
    expect(loaded.groups[0].items.some((i) => i.id === "sc-nas")).toBe(false);
    expect(loaded.groups[0].items[0].url).toBe("https://nav.zhuux.cn");
  });

  it("迁移不碰用户自己编辑过的快捷项", () => {
    window.localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({
        groups: [
          {
            id: "grp-main",
            name: "快捷跳转",
            items: [{ id: "mine-1", title: "我的站点", url: "https://example.org" }],
          },
        ],
      }),
    );
    const loaded = loadConfig();
    expect(loaded.groups[0].items).toHaveLength(1);
    expect(loaded.groups[0].items[0].id).toBe("mine-1");
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
