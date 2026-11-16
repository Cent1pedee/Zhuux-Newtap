import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/csp";

/**
 * 安全响应头。
 *
 * 值本身在 `src/lib/csp.ts`（纯函数 + 单测），这里只负责挂到所有路由上。
 *
 * 关于 connect-src 的取舍、为什么 script-src 需要 'unsafe-inline'、
 * 以及 dev 为什么必须额外放行 'unsafe-eval'，都写在那份文件里 —— 改动之前先读它。
 */
const securityHeaders = buildSecurityHeaders(process.env.NODE_ENV !== "production");

const nextConfig: NextConfig = {
  // 不对外暴露框架版本
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  /*
   * 站点图标现在是 `src/app/icon.svg`（Next 文件约定），但浏览器、书签管理器、
   * RSS 阅读器仍会盲请求 `/favicon.ico`。留一条重写指向 SVG，既不 404，
   * 也不用为了兼容去维护一份会过期的 .ico 二进制。
   * 现代浏览器认 content-type（image/svg+xml），老 IE 本来也不在本项目支持范围。
   */
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon.svg" }];
  },
};

export default nextConfig;
