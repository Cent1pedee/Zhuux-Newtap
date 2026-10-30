/**
 * 安全响应头（纯函数，便于单测）。
 *
 * 从 next.config.ts 抽出来的原因很实际：CSP 写在配置对象里时没有任何测试能覆盖它，
 * 于是「dev 少了 'unsafe-eval' 导致整页 JS 不执行」这种事故只在 `pnpm dev` 里出现，
 * 而 E2E 只跑生产构建 —— 一路绿灯，问题全藏在没人看的地方。
 * 现在它是 `buildCsp(isDev)`：两种环境的差异被显式断言。
 */

/**
 * 生产 vs 开发的两处差异，都是踩过坑的：
 *
 * 1. `'unsafe-eval'` —— `next dev` 用 webpack 以 eval 形式注入模块 + React Refresh。
 *    缺它浏览器直接抛 `Evaluating a string as JavaScript violates ... script-src`，
 *    而这条错误发生在客户端 bundle 执行之前 → hydration 从未发生：
 *    页面能看见，但所有点击（设置、主题、搜索建议）全部无反应。
 * 2. `upgrade-insecure-requests` —— dev 跑在 http://localhost，这条指令会把同源资源
 *    与 HMR 的 ws:// 一起升级成 https/wss，热更新与图片直接失联。
 */
export function buildCsp(isDev: boolean): string {
  return [
    "default-src 'self'",
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'",
    // Motion 与 Tailwind 都会写内联 style，这一条去不掉
    "style-src 'self' 'unsafe-inline'",
    // favicon 与壁纸的域名由用户的快捷项决定，无法枚举；data:/blob: 给本地图片与解码用
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    /**
     * 必须显式写出来：省略 connect-src 时它会回退到 default-src 'self'，
     * 那样一言、天气、壁纸元数据三个接口会被浏览器直接掐断（而应用代码里的白名单照样放行，
     * 排查起来极其割裂）。
     *
     * 这里给 `https:` 而不是四个白名单域名，是因为两处功能允许用户自己填域名：
     * 自定义壁纸（fetchUserImage）与用户自定义白名单。写死会把这两处功能打死。
     * 接口层的白名单仍由 safeFetch 在代码里强制（有单测守着「白名单外不发请求」）。
     */
    "connect-src 'self' https:",
    // 无 JS 兜底的原生表单会直接提交到引擎域名
    "form-action 'self' https://www.google.com https://www.bing.com https://www.baidu.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "worker-src 'self' blob:",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export type Header = { key: string; value: string };

export function buildSecurityHeaders(isDev: boolean): Header[] {
  return [
    { key: "Content-Security-Policy", value: buildCsp(isDev) },
    // 不允许浏览器猜 MIME：静态资源全部自带正确类型
    { key: "X-Content-Type-Options", value: "nosniff" },
    // 任何出站请求都不带 referrer（与 safeFetch / <img> 的 no-referrer 保持一致）
    { key: "Referrer-Policy", value: "no-referrer" },
    // 只留定位（天气需要），其余一律拒绝
    {
      key: "Permissions-Policy",
      value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()",
    },
    // frame-ancestors 的旧浏览器兜底
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
  ];
}
