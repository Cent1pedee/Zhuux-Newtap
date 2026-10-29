/**
 * 服务层（PRD 9.1）：所有远程请求必须经过本封装。
 * 强制约束：
 *  1. 域名必须命中白名单（内置 + 用户自定义），否则直接 reject；
 *  2. 一律带超时（AbortController），超时后由调用方回退本地数据；
 *  3. 不发送 Cookie（credentials: "omit"），不附带任何本地配置。
 */

import { DEFAULT_WHITELIST, EDGE_WALLPAPER, LIMITS } from "@/config/site";

export class WhitelistError extends Error {
  constructor(host: string) {
    super(`请求被拒绝：${host} 不在白名单内`);
    this.name = "WhitelistError";
  }
}

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`请求超时（${ms}ms）`);
    this.name = "TimeoutError";
  }
}

export function effectiveWhitelist(userWhitelist: string[]): string[] {
  return Array.from(new Set([...DEFAULT_WHITELIST, ...userWhitelist].map(normalizeHost))).filter(Boolean);
}

export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
}

export function hostOf(url: string): string {
  try {
    return normalizeHost(new URL(url).host);
  } catch {
    return "";
  }
}

export function isAllowed(url: string, whitelist: string[]): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return effectiveWhitelist(whitelist).some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

export type SafeFetchOptions = {
  whitelist: string[];
  timeoutMs?: number;
  init?: RequestInit;
};

export async function safeFetch(url: string, options: SafeFetchOptions): Promise<Response> {
  const { whitelist, timeoutMs = LIMITS.quoteTimeoutMs, init } = options;
  if (!isAllowed(url, whitelist)) {
    throw new WhitelistError(hostOf(url) || url);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch (err) {
    if (controller.signal.aborted) throw new TimeoutError(timeoutMs);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------ 远程一言 ------------------------------ */

export type RemoteQuote = { text: string; from: string };

export async function fetchRemoteQuote(whitelist: string[], signalTimeout = LIMITS.quoteTimeoutMs): Promise<RemoteQuote> {
  const url = "https://v1.hitokoto.cn/?encode=json&charset=utf-8";
  const res = await safeFetch(url, { whitelist, timeoutMs: signalTimeout });
  const data = (await res.json()) as { hitokoto?: string; from?: string; from_who?: string };
  const text = typeof data.hitokoto === "string" ? data.hitokoto.trim() : "";
  if (!text) throw new Error("远程一言返回为空");
  const from = data.from_who || data.from || "佚名";
  return { text, from };
}

/* ------------------------------ 搜索建议 ------------------------------ */

export async function fetchSuggestions(
  engineId: string,
  query: string,
  whitelist: string[],
  suggestUrl?: string,
): Promise<string[]> {
  if (!suggestUrl || !query.trim()) return [];
  const url = suggestUrl.replace("{q}", encodeURIComponent(query));
  const res = await safeFetch(url, { whitelist, timeoutMs: LIMITS.suggestTimeoutMs });
  const data = (await res.json()) as unknown;
  // 兼容 osjson 与 OpenSearch 两种格式
  if (Array.isArray(data) && data.length > 1 && Array.isArray(data[1])) {
    return (data[1] as unknown[]).filter((s): s is string => typeof s === "string").slice(0, 8);
  }
  if (Array.isArray(data)) {
    return data
      .map((item) => (Array.isArray(item) ? item[0] : item))
      .filter((s): s is string => typeof s === "string")
      .slice(0, 8);
  }
  return [];
}

/* ------------------------------ 天气 ------------------------------ */

export type WeatherNow = { temperature: number; code: number; isDay: boolean };

/** Open-Meteo：无需 API key，只发经纬度，不发任何本地数据 */
export async function fetchWeather(
  lat: number,
  lon: number,
  unit: "c" | "f",
  whitelist: string[],
): Promise<WeatherNow> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}` +
    `&current=temperature_2m,weather_code,is_day&timezone=auto` +
    (unit === "f" ? "&temperature_unit=fahrenheit" : "");
  const res = await safeFetch(url, { whitelist, timeoutMs: 4000 });
  const data = (await res.json()) as {
    current?: { temperature_2m?: number; weather_code?: number; is_day?: number };
  };
  const current = data.current;
  if (!current || typeof current.temperature_2m !== "number") throw new Error("天气数据为空");
  return {
    temperature: Math.round(current.temperature_2m),
    code: current.weather_code ?? 0,
    isDay: current.is_day !== 0,
  };
}

export function weatherLabel(code: number): string {
  if (code === 0) return "晴";
  if (code <= 3) return "多云";
  if (code <= 48) return "雾";
  if (code <= 57) return "毛毛雨";
  if (code <= 67) return "雨";
  if (code <= 77) return "雪";
  if (code <= 82) return "阵雨";
  if (code <= 86) return "阵雪";
  return "雷雨";
}

/* ------------------------------ Edge 每日壁纸 ------------------------------ */

export type EdgeWallpaper = {
  /** 可直接放进 <img src> 的图片地址 */
  url: string;
  /** 版权说明，例如「库涅季采山城堡，波希米亚，捷克 (© …)」 */
  copyright: string;
  /** 版权详情页 */
  link: string;
  /** 日期 yyyy-mm-dd（API 不可用时为空） */
  date: string;
};

/**
 * 取 Edge（Bing）每日壁纸元数据。
 * API 走 bing.biturl.top（带 access-control-allow-origin: *），
 * 图片本体是 bing.com 的 th?id= 直链，由 <img> 加载，不受 CORS 限制。
 * 任何字段缺失/格式异常都抛错，由调用方回退到渐变兜底。
 */
export async function fetchEdgeWallpaper(
  whitelist: string[],
  offset = 0,
  timeoutMs = LIMITS.wallpaperTimeoutMs,
): Promise<EdgeWallpaper> {
  const index = Math.min(Math.max(0, Math.trunc(offset)), EDGE_WALLPAPER.maxOffset);
  const url = `${EDGE_WALLPAPER.apiBase}?resolution=1920&format=json&index=${index}&mkt=${EDGE_WALLPAPER.market}`;
  const res = await safeFetch(url, { whitelist, timeoutMs });
  const data = (await res.json()) as {
    url?: unknown;
    copyright?: unknown;
    copyright_link?: unknown;
    start_date?: unknown;
    end_date?: unknown;
  };

  const rawUrl = typeof data.url === "string" ? data.url.trim() : "";
  if (!rawUrl) throw new Error("每日壁纸返回为空");
  // API 返回的可能是 // 开头的协议相对地址
  const absolute = rawUrl.startsWith("//")
    ? `https:${rawUrl}`
    : rawUrl.startsWith("/")
      ? `${EDGE_WALLPAPER.imageHost}${rawUrl}`
      : rawUrl;
  if (!/^https?:\/\//i.test(absolute)) throw new Error("每日壁纸地址非法");

  const rawDate = typeof data.start_date === "string" ? data.start_date : "";
  const date =
    rawDate.length === 8 ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : rawDate;

  return {
    url: absolute,
    copyright: typeof data.copyright === "string" ? data.copyright.trim() : "",
    link: typeof data.copyright_link === "string" ? data.copyright_link.trim() : "",
    date,
  };
}
