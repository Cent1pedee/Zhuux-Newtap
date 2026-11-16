/**
 * 站点 favicon 推导（零依赖、零第三方代理）。
 *
 * 把一个用户填的网址变成「该站点自己的一组候选图标地址」。
 * 不经过任何图标聚合服务（那些服务会知道用户收藏了哪些站点，属于多余的信息泄露），
 * 也不下载、不缓存 —— 直接交给 <img> 加载，失败就试下一个，全部失败由调用方回退首字母。
 *
 * 为什么是一组而不是一个：
 *   `/favicon.ico` 只覆盖「把图标放在根目录、用 ico 格式」的站点。
 *   现代站点常用 `<link rel="icon" href="/assets/icon.svg">` 或 apple-touch-icon，
 *   根目录 /favicon.ico 直接 404；反过来，老站点只有 /favicon.ico。
 *   跨域读不到 HTML（CORS），没法解析 <link>，所以用一组最常见的约定路径逐个探测。
 *
 * 与 `safeFetch` 白名单的关系见 `src/config/site.ts` 里 favicon 的注释：
 * 白名单约束的是「带 Cookie / 带参数的接口请求」，favicon 是图床式的静态图片 GET，
 * 目标域名由用户的快捷项决定，无法预先枚举，因此走 <img> 直连 + no-referrer。
 */

import { hostOf } from "@/lib/services";

/** 内网地址（192.168.x / 10.x / 172.16-31.x / localhost）基本不会有 favicon，直接跳过 */
export function isPrivateHost(host: string): boolean {
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".localhost")) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!v4) return false;
  const a = Number(v4[1] ?? "");
  const b = Number(v4[2] ?? "");
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

/**
 * 候选路径，按「命中率优先、清晰度其次」排，最多三条：
 *   1. favicon.ico   —— 最老也最普遍；先命中它，绝大多数站点一次就够
 *   2. apple-touch-icon.png —— 通常 180×180，缩到 42/52px 比 16px 的 ico 干净
 *   3. favicon.svg   —— 新站点常用，矢量任意缩放
 * 只保留三条是刻意的：13 个图标 × 5 条候选 = 65 个请求，
 * 首屏会被一串必然 404 的探测拖慢。三条覆盖绝大多数站点，
 * 全失败就交给统一的首字母兜底。
 * 不再拼 `?size=`：不少 CDN 对带 query 的静态路径直接 404，白白多一轮失败。
 */
const ICON_PATHS = ["/favicon.ico", "/apple-touch-icon.png", "/favicon.svg"] as const;

/**
 * 给定页面地址，返回该站点根域的候选图标地址（按优先级）。
 * 取不到（非 http(s) / 内网 / 非法 URL）时返回空数组 —— 调用方据此跳过请求。
 */
export function faviconCandidates(pageUrl: string): string[] {
  if (!/^https?:/i.test(pageUrl)) return [];
  let host: string;
  try {
    host = hostOf(pageUrl);
  } catch {
    return [];
  }
  if (!host || isPrivateHost(host)) return [];
  return ICON_PATHS.map((path) => `https://${host}${path}`);
}

/** 只需要一个地址时（例如引擎徽标的首帧）取优先级最高的那个 */
export function faviconUrl(pageUrl: string): string {
  return faviconCandidates(pageUrl)[0] ?? "";
}

/** 供设置面板展示「这个链接能不能自动取图标」用 */
export function faviconCapability(pageUrl: string): "ok" | "private" | "invalid" {
  if (!/^https?:/i.test(pageUrl)) return "invalid";
  const host = hostOf(pageUrl);
  if (!host) return "invalid";
  if (isPrivateHost(host)) return "private";
  return "ok";
}
