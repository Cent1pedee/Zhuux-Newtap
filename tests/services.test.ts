import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WhitelistError,
  effectiveWhitelist,
  fetchSuggestions,
  fetchUserImage,
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

/**
 * 自定义壁纸：唯一不走白名单的请求，但隐私姿势与体积约束不能松。
 *
 * 这里用手写的 response 替身而不是 `new Response(...)`：jsdom 的 Blob/Response
 * 实现不完整（Blob 没有 stream()、构造 Response 时直接抛错），测的是本函数的
 * 判定逻辑，不是 fetch 实现。
 */
type FakeBody = { getReader: () => { read: () => Promise<{ done: boolean; value?: Uint8Array }>; cancel: () => void } };

function fakeResponse(opts: {
  status?: number;
  headers?: Record<string, string>;
  body?: FakeBody | null;
  blob?: Blob;
}) {
  const headers = opts.headers ?? {};
  return {
    ok: (opts.status ?? 200) >= 200 && (opts.status ?? 200) < 300,
    status: opts.status ?? 200,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    body: opts.body ?? undefined,
    blob: async () => opts.blob ?? new Blob([new Uint8Array(0)]),
  };
}

function streamOf(chunks: Uint8Array[]): FakeBody {
  let i = 0;
  return {
    getReader: () => ({
      read: async () =>
        i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined },
      cancel: () => {},
    }),
  };
}

describe("fetchUserImage（自定义壁纸）", () => {
  it("非 http(s) 地址直接拒绝且不发请求", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    await expect(fetchUserImage("data:image/png;base64,AAAA")).rejects.toThrow("http(s)");
    expect(spy).not.toHaveBeenCalled();
  });

  it("始终带 omit credentials 与 no-referrer", async () => {
    const seen: RequestInit[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        seen.push(init ?? {});
        return fakeResponse({ headers: { "content-type": "image/png" }, blob: new Blob([new Uint8Array(16)]) });
      }),
    );
    const blob = await fetchUserImage("https://img.example.com/a.png");
    expect(blob.size).toBe(16);
    expect(seen[0]?.credentials).toBe("omit");
    expect(seen[0]?.referrerPolicy).toBe("no-referrer");
    expect(seen[0]?.signal).toBeDefined();
  });

  it("返回非图片 content-type 时拒绝", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => fakeResponse({ headers: { "content-type": "text/html" } })));
    await expect(fetchUserImage("https://img.example.com/a.png")).rejects.toThrow("不是图片");
  });

  it("Content-Length 超限时立刻拒绝", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        fakeResponse({ headers: { "content-type": "image/png", "content-length": String(64 * 1024 * 1024) } }),
      ),
    );
    await expect(fetchUserImage("https://img.example.com/a.png", { maxBytes: 1024 })).rejects.toThrow("体积超过上限");
  });

  it("无 Content-Length 时按流式累计卡上限（不会把整个大图读进内存）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        fakeResponse({
          headers: { "content-type": "image/jpeg" },
          body: streamOf(Array.from({ length: 8 }, () => new Uint8Array(1024))),
        }),
      ),
    );
    await expect(fetchUserImage("https://img.example.com/a.jpg", { maxBytes: 2048 })).rejects.toThrow("体积超过上限");
  });

  it("流式读取正常时拼成完整 Blob", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        fakeResponse({
          headers: { "content-type": "image/jpeg" },
          body: streamOf([new Uint8Array(1024), new Uint8Array(1024)]),
        }),
      ),
    );
    const blob = await fetchUserImage("https://img.example.com/a.jpg");
    expect(blob.size).toBe(2048);
  });

  it("超时抛 TimeoutError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          }),
      ),
    );
    await expect(fetchUserImage("https://img.example.com/a.png", { timeoutMs: 20 })).rejects.toMatchObject({
      name: "TimeoutError",
    });
  });
});
