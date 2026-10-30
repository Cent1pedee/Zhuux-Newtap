import { describe, expect, it } from "vitest";
import { createDefaultConfig } from "@/config/defaults";
import { LIMITS } from "@/config/site";
import { mergeConfig } from "@/lib/config-schema";

/**
 * 导入/读盘闸门的字段级校验。
 * 这些用例全部对应真实可复现的崩溃路径，不是形式化覆盖：
 * 一个手改的 localStorage 值就能让某个模块白屏。
 */
describe("mergeConfig：可空字段", () => {
  const base = createDefaultConfig();

  it("weather.lat 被写成字符串时回退 null（否则 fetchWeather 里 toFixed 抛错）", () => {
    const merged = mergeConfig(base, { weather: { lat: "39.9", lon: "116.4" } });
    expect(merged.weather.lat).toBeNull();
    expect(merged.weather.lon).toBeNull();
  });

  it("weather.lat 显式传 null 是合法值（表示未选择）", () => {
    const seeded = { ...createDefaultConfig(), weather: { ...base.weather, lat: 1, lon: 2 } };
    const merged = mergeConfig(seeded, { weather: { lat: null } });
    expect(merged.weather.lat).toBeNull();
    expect(merged.weather.lon).toBe(2);
  });

  it("坐标越界被 clamp 到合法区间", () => {
    const merged = mergeConfig(base, { weather: { lat: 999, lon: -999 } });
    expect(merged.weather.lat).toBe(90);
    expect(merged.weather.lon).toBe(-180);
  });

  it("a11y.reducedMotion 只接受 boolean 与 null", () => {
    expect(mergeConfig(base, { a11y: { reducedMotion: "yes" } }).a11y.reducedMotion).toBeNull();
    expect(mergeConfig(base, { a11y: { reducedMotion: true } }).a11y.reducedMotion).toBe(true);
    expect(mergeConfig(base, { a11y: { reducedMotion: null } }).a11y.reducedMotion).toBeNull();
  });
});

describe("mergeConfig：枚举与数值", () => {
  const base = createDefaultConfig();

  it("非法主题枚举回退默认（否则 data-theme 指向不存在的主题）", () => {
    const merged = mergeConfig(base, { theme: { mode: "purple" } });
    expect(merged.theme.mode).toBe(base.theme.mode);
  });

  it("非法强调色回退默认", () => {
    expect(mergeConfig(base, { theme: { accent: "red" } }).theme.accent).toBe(base.theme.accent);
    expect(mergeConfig(base, { theme: { accent: "#abc" } }).theme.accent).toBe("#abc");
    expect(mergeConfig(base, { theme: { accent: "#AABBCC" } }).theme.accent).toBe("#AABBCC");
  });

  it("模糊与暗化越界被 clamp（blur:9999 会糊死整页）", () => {
    const merged = mergeConfig(base, { background: { blur: 9999, dim: -50 } });
    expect(merged.background.blur).toBe(20);
    expect(merged.background.dim).toBe(0);
  });

  it("背景回溯天数限定在 0-7", () => {
    expect(mergeConfig(base, { background: { offset: 99 } }).background.offset).toBe(7);
    expect(mergeConfig(base, { background: { offset: -3 } }).background.offset).toBe(0);
  });

  it("NaN / Infinity 不写入", () => {
    const merged = mergeConfig(base, { clock: { show: "true" } });
    expect(merged.clock.show).toBe(base.clock.show);
  });
});

describe("mergeConfig：数组元素校验", () => {
  const base = createDefaultConfig();

  it("快捷项缺少 title 或 url 非法时被丢弃", () => {
    const merged = mergeConfig(base, {
      groups: [
        {
          id: "g1",
          name: "测试",
          items: [
            { id: "ok", title: "正常", url: "https://example.com", iconKind: "letter", iconValue: "" },
            { id: "no-title", url: "https://example.com" },
            { id: "bad-url", title: "坏链接", url: "javascript:alert(1)" },
            { id: "no-id", title: "无 id", url: "https://a.dev" },
          ],
        },
      ],
    });
    expect(merged.groups).toHaveLength(1);
    expect(merged.groups[0].items.map((i) => i.title)).toEqual(["正常", "无 id"]);
    // 缺 id 的项会被补一个可用的 id，不能是 undefined
    expect(merged.groups[0].items[1].id).toBeTruthy();
  });

  it("快捷项标题按 LIMITS 截断", () => {
    const long = "字".repeat(40);
    const merged = mergeConfig(base, {
      groups: [
        {
          id: "g1",
          name: "测试",
          items: [{ id: "a", title: long, url: "https://a.dev", iconKind: "letter", iconValue: "" }],
        },
      ],
    });
    expect(merged.groups[0].items[0].title).toHaveLength(LIMITS.shortcutTitleMax);
  });

  it("分组数量受 LIMITS.maxGroups 限制", () => {
    const many = Array.from({ length: LIMITS.maxGroups + 5 }, (_, g) => ({
      id: `g${g}`,
      name: `组${g}`,
      items: [{ id: `s${g}`, title: `项${g}`, url: `https://s${g}.dev`, iconKind: "letter", iconValue: "" }],
    }));
    const merged = mergeConfig(base, { groups: many });
    expect(merged.groups).toHaveLength(LIMITS.maxGroups);
  });

  it("快捷项总数受 LIMITS.maxShortcuts 限制", () => {
    const many = Array.from({ length: 3 }, (_, g) => ({
      id: `g${g}`,
      name: `组${g}`,
      items: Array.from({ length: 120 }, (_, i) => ({
        id: `s${g}-${i}`,
        title: `项${i}`,
        url: `https://s${g}-${i}.dev`,
        iconKind: "letter",
        iconValue: "",
      })),
    }));
    const merged = mergeConfig(base, { groups: many });
    const total = merged.groups.reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(LIMITS.maxShortcuts);
  });

  it("快捷指令缺 key 前缀或 siteUrl 时被丢弃", () => {
    const merged = mergeConfig(base, {
      quickCommands: [
        { id: "c1", key: "g", label: "无斜杠", url: "https://a.dev?q={q}", siteUrl: "https://a.dev" },
        { id: "c2", key: "/x", label: "正常", url: "https://x.dev?q={q}", siteUrl: "https://x.dev" },
      ],
    });
    expect(merged.quickCommands.map((c) => c.id)).toEqual(["c2"]);
  });

  it("本地壁纸 dataURL 不会被截断（8MB 图片转 base64 约 11M 字符）", () => {
    const dataUrl = `data:image/jpeg;base64,${"A".repeat(11_000_000)}`;
    const merged = mergeConfig(base, { wallpaper: { source: "local", value: dataUrl } });
    expect(merged.wallpaper.value).toHaveLength(dataUrl.length);
    expect(merged.wallpaper.value.endsWith("AAAA")).toBe(true);
  });

  it("白名单只保留字符串并去空、限长", () => {
    const merged = mergeConfig(base, {
      privacy: { whitelist: ["a.dev", "", 42, null, "  b.dev  "] },
    });
    expect(merged.privacy.whitelist).toEqual(["a.dev", "b.dev"]);
  });
});

describe("mergeConfig：正常数据不受影响", () => {
  it("导出一份默认配置再导入，结果与原始一致", () => {
    const base = createDefaultConfig();
    const roundTrip = mergeConfig(createDefaultConfig(), JSON.parse(JSON.stringify(base)));
    expect(roundTrip).toEqual(base);
  });

  it("未知顶层字段与未知子字段都被丢弃", () => {
    const merged = mergeConfig(createDefaultConfig(), {
      hacker: true,
      theme: { mode: "light", evil: "x" },
    }) as unknown as Record<string, unknown>;
    expect(merged.hacker).toBeUndefined();
    expect((merged.theme as Record<string, unknown>).evil).toBeUndefined();
    expect((merged.theme as Record<string, unknown>).mode).toBe("light");
  });
});
