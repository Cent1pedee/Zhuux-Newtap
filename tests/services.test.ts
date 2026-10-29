import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WhitelistError,
  effectiveWhitelist,
  fetchSuggestions,
  hostOf,
  isAllowed,
  normalizeHost,
  safeFetch,
  weatherLabel,
} from "@/lib/services";
import { DEFAULT_WHITELIST } from "@/config/site";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("域名归一化", () => {
  it("normalizeHost 去掉协议、路径、端口", () => {
    expect(normalizeHost("https://API.Bing.com:443/osjson")).toBe("api.bing.com");
    expect(normalizeHost("  Example.com/Path ")).toBe("example.com");
  });

  it("hostOf 解析 URL", () => {
    expect(hostOf("https://v1.hitokoto.cn/?a=1")).toBe("v1.hitokoto.cn");
    expect(hostOf("not a url")).toBe("");
  });
});

describe("白名单校验（隐私基线）", () => {
  it("默认白名单包含三个可选服务域名", () => {
    expect(DEFAULT_WHITELIST).toEqual(
      expect.arrayContaining(["v1.hitokoto.cn", "api.bing.com", "api.open-meteo.com"]),
    );
  });

  it("白名单内域名放行", () => {
    expect(isAllowed("https://v1.hitokoto.cn/?x=1", [])).toBe(true);
  });

  it("子域名匹配父域名", () => {
    expect(isAllowed("https://cdn.v1.hitokoto.cn/", [])).toBe(true);
  });

  it("白名单外域名被拒绝", () => {
    expect(isAllowed("https://evil.example.com/", [])).toBe(false);
  });

  it("后缀伪装域名不被放行", () => {
    expect(isAllowed("https://hitokoto.cn.evil.com/", [])).toBe(false);
  });

  it("用户自定义白名单生效", () => {
    expect(isAllowed("https://mysite.dev/x", ["mysite.dev"])).toBe(true);
  });

  it("effectiveWhitelist 去重合并", () => {
    const list = effectiveWhitelist(["v1.hitokoto.cn", "extra.com"]);
    expect(list.filter((h) => h === "v1.hitokoto.cn")).toHaveLength(1);
    expect(list).toContain("extra.com");
  });
});

describe("safeFetch 强制约束", () => {
  it("白名单外请求直接抛 WhitelistError 且不调用 fetch", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    await expect(safeFetch("https://evil.com/x", { whitelist: [] })).rejects.toBeInstanceOf(WhitelistError);
    expect(spy).not.toHaveBeenCalled();
  });

  it("白名单内请求带上 credentials omit 与 no-referrer", async () => {
    const spy = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", spy);
    await safeFetch("https://api.bing.com/osjson.aspx?query=x", { whitelist: [] });
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe("omit");
    expect(init.referrerPolicy).toBe("no-referrer");
  });

  it("非 2xx 抛错", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await expect(safeFetch("https://api.bing.com/x", { whitelist: [] })).rejects.toThrow("HTTP 500");
  });

  it("超时触发 TimeoutError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          }),
      ),
    );
    await expect(safeFetch("https://api.bing.com/x", { whitelist: [], timeoutMs: 20 })).rejects.toMatchObject({
      name: "TimeoutError",
    });
  });
});

describe("fetchSuggestions", () => {
  it("无 suggestUrl 时返回空数组且不发请求", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect(await fetchSuggestions("baidu", "react", [], undefined)).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("空查询返回空数组", async () => {
    expect(await fetchSuggestions("bing", "  ", [], "https://api.bing.com/osjson.aspx?query={q}")).toEqual([]);
  });

  it("解析 osjson 格式并截断到 8 条", async () => {
    const payload = ["react", ["react", "reactjs", "react hooks", "react router", "react native", "react dom", "react query", "react table", "react 18"]];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })));
    const list = await fetchSuggestions("bing", "react", [], "https://api.bing.com/osjson.aspx?query={q}");
    expect(list).toHaveLength(8);
    expect(list[0]).toBe("react");
  });
});

describe("weatherLabel", () => {
  it("按 WMO 代码返回中文描述", () => {
    expect(weatherLabel(0)).toBe("晴");
    expect(weatherLabel(2)).toBe("多云");
    expect(weatherLabel(45)).toBe("雾");
    expect(weatherLabel(61)).toBe("雨");
    expect(weatherLabel(73)).toBe("雪");
    expect(weatherLabel(95)).toBe("雷雨");
  });
});
