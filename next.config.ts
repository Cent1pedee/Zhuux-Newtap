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
};

export default nextConfig;
