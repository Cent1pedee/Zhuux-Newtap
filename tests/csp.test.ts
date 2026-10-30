import { describe, expect, it } from "vitest";
import { buildCsp, buildSecurityHeaders } from "@/lib/csp";

/**
 * CSP 回归测试。
 *
 * 存在的理由：`script-src` 少一个 'unsafe-eval' 会让 `pnpm dev` 整页 JS 不执行，
 * 而所有 E2E 都跑生产构建 —— 这种事故以前没有任何测试能拦住。
 */
describe("CSP：开发环境", () => {
  const csp = buildCsp(true);

  it("必须放行 'unsafe-eval'，否则 next dev 的 eval 模块注入失败、hydration 不发生", () => {
    expect(csp).toContain("'unsafe-eval'");
  });

  it("不能带 upgrade-insecure-requests（会把 localhost 与 HMR 的 ws 打成 https/wss）", () => {
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});

describe("CSP：生产环境", () => {
  const csp = buildCsp(false);

  it("不放行 'unsafe-eval'", () => {
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("保留 'unsafe-inline'（首屏主题脚本与 Next 水合脚本都是内联的）", () => {
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
  });

  it("带 upgrade-insecure-requests", () => {
    expect(csp).toContain("upgrade-insecure-requests");
  });
});

describe("CSP：两条容易被误删的指令", () => {
  const csp = buildCsp(false);

  it("connect-src 必须显式存在 —— 省略会回退到 default-src 'self'，掐断一言/天气/壁纸", () => {
    expect(csp).toMatch(/connect-src 'self' https:/);
  });

  it("form-action 必须放行三家引擎 —— 无 JS 兜底时表单直接提交到它们的域名", () => {
    for (const host of ["google.com", "bing.com", "baidu.com"]) {
      expect(csp).toContain(host);
    }
  });

  it("禁止被嵌套与插件内容", () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});

describe("安全响应头", () => {
  const headers = buildSecurityHeaders(false);

  it("包含 CSP 与四条基础头", () => {
    const keys = headers.map((h) => h.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Permissions-Policy",
        "X-Frame-Options",
      ]),
    );
  });

  it("Referrer-Policy 为 no-referrer（与 safeFetch / <img> 一致）", () => {
    expect(headers.find((h) => h.key === "Referrer-Policy")?.value).toBe("no-referrer");
  });

  it("Permissions-Policy 只放行同源定位", () => {
    const value = headers.find((h) => h.key === "Permissions-Policy")?.value ?? "";
    expect(value).toContain("geolocation=(self)");
    expect(value).toContain("camera=()");
    expect(value).toContain("microphone=()");
  });
});
