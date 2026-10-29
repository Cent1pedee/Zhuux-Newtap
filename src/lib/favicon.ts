/**
 * 站点 favicon 推导（零依赖、零第三方代理）。
 *
 * 只做一件事：把一个用户填的网址变成「该站点自己的 /favicon.ico」地址。
 * 不经过任何图标聚合服务（那些服务会知道用户收藏了哪些站点，属于多余的信息泄露），
 * 也不下载、不缓存 —— 直接交给 <img> 加载，失败就由调用方回退首字母。
 *
 * 与 `safeFetch` 白名单的关系见 `src/config/site.ts` 里 `FAVICON_PATH` 的注释：
 * 白名单约束的是「带 Cookie / 带参数的接口请求」，favicon 是图床式的静态图片 GET，
 * 目标域名由用户的快捷项决定，无法预先枚举，因此走 <img> 直连 + no-referrer。
 */

import { FAVICON_PATH } from "@/config/site";
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
 * 给定页面地址，返回该站点根域的 favicon 地址。
 * 取不到（非 http(s) / 内网 / 非法 URL）时返回空串 —— 调用方据此跳过请求。
 */
export function faviconUrl(pageUrl: string, size = 64): string {
  if (!/^https?:/i.test(pageUrl)) return "";
  const host = hostOf(pageUrl);
  if (!host || isPrivateHost(host)) return "";
  // yandex / duckduckgo 之外的站点基本都响应 /favicon.ico；
  // 加 ?v= size 只是让部分 CDN 返回更合适的尺寸，取不到也无害。
  return `https://${host}${FAVICON_PATH}?size=${size}`;
}

/** 供设置面板展示「这个链接能不能自动取图标」用 */
export function faviconCapability(pageUrl: string): "ok" | "private" | "invalid" {
  if (!/^https?:/i.test(pageUrl)) return "invalid";
  const host = hostOf(pageUrl);
  if (!host) return "invalid";
  if (isPrivateHost(host)) return "private";
  return "ok";
}
