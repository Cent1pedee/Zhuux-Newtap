/**
 * 单一配置源（PRD 6.3：配置层为单一数据源）
 * 引擎 / 快捷指令 / 默认分组 / 主题色板 / 白名单 全部在此维护。
 */

export type Engine = {
  id: string;
  name: string;
  /** 搜索地址，{q} 会被 encodeURIComponent 后的关键词替换 */
  searchUrl: string;
  /** 原生表单 GET 的提交地址（无 JS 兜底，PRD 4.1 / 6.5） */
  formAction: string;
  /** 原生表单的查询参数名 */
  param: string;
  /** 可选 suggest 接口（P1，默认关闭） */
  suggestUrl?: string;
  /** 官网首页：搜索框为空时直接打开这里（PRD 4.1 修订） */
  homeUrl: string;
  /** 展示用字符（favicon 取不到时的兜底） */
  glyph: string;
  /** 品牌色，用于图标底色 */
  color: string;
};

export const ENGINES: Engine[] = [
  {
    id: "google",
    name: "Google",
    searchUrl: "https://www.google.com/search?q={q}",
    formAction: "https://www.google.com/search",
    param: "q",
    homeUrl: "https://www.google.com",
    glyph: "G",
    color: "#4285F4",
  },
  {
    id: "bing",
    name: "Bing",
    searchUrl: "https://www.bing.com/search?q={q}",
    formAction: "https://www.bing.com/search",
    param: "q",
    suggestUrl: "https://api.bing.com/osjson.aspx?query={q}",
    homeUrl: "https://www.bing.com",
    glyph: "b",
    color: "#008373",
  },
  {
    id: "baidu",
    name: "百度",
    searchUrl: "https://www.baidu.com/s?wd={q}",
    formAction: "https://www.baidu.com/s",
    param: "wd",
    homeUrl: "https://www.baidu.com",
    glyph: "百",
    color: "#2932E1",
  },
];

/**
 * 默认引擎（PRD 4.1 修订）：仅保留 Google / Bing / 百度 三个主流引擎。
 * 选 Google 作为全球默认；中文环境可在设置里一键切到百度 / Bing。
 */
export const DEFAULT_ENGINE_ID = "google";

export type QuickCommand = {
  id: string;
  /** 输入框内触发词，形如 /g */
  key: string;
  label: string;
  /** {q} 为关键词占位；无关键词时直接打开 url 本体 */
  url: string;
  siteUrl: string;
};

export const QUICK_COMMANDS: QuickCommand[] = [
  {
    id: "cmd-github",
    key: "/g",
    label: "GitHub",
    url: "https://github.com/search?q={q}",
    siteUrl: "https://github.com",
  },
  {
    id: "cmd-baidu",
    key: "/b",
    label: "百度",
    url: "https://www.baidu.com/s?wd={q}",
    siteUrl: "https://www.baidu.com",
  },
  {
    id: "cmd-bili",
    key: "/bili",
    label: "哔哩哔哩",
    url: "https://search.bilibili.com/all?keyword={q}",
    siteUrl: "https://www.bilibili.com",
  },
];

export type ShortcutIconKind = "letter" | "emoji" | "image";

export type Shortcut = {
  id: string;
  title: string;
  url: string;
  iconKind: ShortcutIconKind;
  /** letter: 取首字母；emoji: 字符；image: 图片 URL 或 dataURL */
  iconValue: string;
  color?: string;
};

export type ShortcutGroup = {
  id: string;
  name: string;
  items: Shortcut[];
};

/**
 * 默认快捷项。
 * 界面不再分组 —— 全部图标排成一条 dock（参考青柠起始页底部），
 * 因此默认只有「一个分组」这个容器，纯粹为了让数据结构保持向后兼容。
 */
export const DEFAULT_GROUPS: ShortcutGroup[] = [
  {
    id: "grp-main",
    name: "快捷跳转",
    items: [
      // 公网站点一律留空 iconValue —— 交给 favicon 自动抓取（见 shortcut-icon.tsx 的降级链），
      // 抓不到才退回首字母。内网服务没有可抓的图标，直接给 Emoji，免得永远显示灰字。
      { id: "sc-nas", title: "NAS", url: "http://192.168.1.10:5000", iconKind: "emoji", iconValue: "🗄️", color: "#2F6FED" },
      { id: "sc-grafana", title: "Grafana", url: "http://192.168.1.10:3000", iconKind: "letter", iconValue: "", color: "#F46800" },
      { id: "sc-uptime", title: "Uptime", url: "http://192.168.1.10:3001", iconKind: "letter", iconValue: "", color: "#5CDD8B" },
      { id: "sc-jellyfin", title: "Jellyfin", url: "http://192.168.1.10:8096", iconKind: "emoji", iconValue: "🎬", color: "#AA5CC3" },
      { id: "sc-github", title: "GitHub", url: "https://github.com", iconKind: "letter", iconValue: "", color: "#24292F" },
      { id: "sc-bili", title: "哔哩哔哩", url: "https://www.bilibili.com", iconKind: "letter", iconValue: "", color: "#FB7299" },
      { id: "sc-zhihu", title: "知乎", url: "https://www.zhihu.com", iconKind: "letter", iconValue: "", color: "#0084FF" },
      { id: "sc-weibo", title: "微博", url: "https://weibo.com", iconKind: "letter", iconValue: "", color: "#E6162D" },
      { id: "sc-mdn", title: "MDN", url: "https://developer.mozilla.org", iconKind: "letter", iconValue: "", color: "#000000" },
      { id: "sc-npm", title: "npm", url: "https://www.npmjs.com", iconKind: "letter", iconValue: "", color: "#CB3837" },
      { id: "sc-vercel", title: "Vercel", url: "https://vercel.com/dashboard", iconKind: "letter", iconValue: "", color: "#000000" },
      { id: "sc-canIuse", title: "Can I use", url: "https://caniuse.com", iconKind: "letter", iconValue: "", color: "#1F7A3F" },
    ],
  },
];

/** 8 个预设强调色（PRD 5.1） */
export const ACCENTS = [
  { id: "blue", name: "品牌蓝", value: "#2F6FED" },
  { id: "violet", name: "紫罗兰", value: "#7C5CFF" },
  { id: "cyan", name: "青碧", value: "#0EA5A5" },
  { id: "green", name: "松绿", value: "#12A150" },
  { id: "amber", name: "琥珀", value: "#D97706" },
  { id: "rose", name: "玫红", value: "#E11D63" },
  { id: "orange", name: "赤橙", value: "#EA580C" },
  { id: "slate", name: "雾蓝灰", value: "#64748B" },
] as const;

export const DEFAULT_ACCENT = "#2F6FED";

/**
 * Edge（Bing）每日壁纸。
 * 元数据走 bing.biturl.top（带 CORS 头），图片本身是 bing.com 的 th?id= 直链，
 * 由 <img> 加载（图片标签不受 CORS 约束）。
 */
export const EDGE_WALLPAPER = {
  /** 取当天/回溯第 N 天的元数据，返回 JSON */
  apiBase: "https://bing.biturl.top/",
  /** 图片直链前缀（API 返回完整 url，这里只用于兜底拼装） */
  imageHost: "https://www.bing.com",
  /** 市场：中文优先 */
  market: "zh-CN",
  /** 可回溯的最大天数（API 支持 0-7） */
  maxOffset: 7,
} as const;

/** 纯渐变兜底背景（无网络、无图片时使用） */
export const FALLBACK_GRADIENT =
  "linear-gradient(135deg, #0b1220 0%, #101a2e 42%, #1b2740 72%, #0a0f1a 100%)";

/**
 * 请求白名单（PRD 9.1）：fetch 封装强制校验，白名单外直接拒绝。
 * 默认仅保留「用户显式开启对应功能后才需要」的域名。
 */
export const DEFAULT_WHITELIST = [
  "v1.hitokoto.cn", // 远程一言（默认开启）
  "api.bing.com", // 搜索建议（默认关闭）
  "api.open-meteo.com", // 天气（默认开启）
  "bing.biturl.top", // Edge 每日壁纸元数据（默认开启）
];

/**
 * favicon 抓取（默认开启）为什么不在白名单模型里
 * -------------------------------------------------
 * 白名单是给 `safeFetch`（JSON 接口）用的：那些请求带 Cookie 风险、带参数，
 * 必须逐域名放行。favicon 不是这类请求 —— 它是浏览器给 <img> 发的一次图片 GET，
 * 目标就是用户自己填进 Dock 的那个站点，域名无法预先枚举（白名单也写不出来）。
 * 因此 favicon 走 <img> 直连、显式 `referrerPolicy="no-referrer"`：
 *   · 不发 Cookie、不带上一个页面的地址；
 *   · 拿不到就 onError 回退首字母，不会卡住布局；
 *   · 用的是站点自带的 /favicon.ico，不是第三方图标代理。
 * 想彻底禁掉这次请求，设置 → 隐私与数据里关掉「抓取站点 favicon」即可。
 */
export const FAVICON_PATH = "/favicon.ico";

export const SITE = {
  title: "起始页 · Startpage",
  description: "一屏即达的个人起始页：搜索、时间、一言、快捷跳转与 Edge 每日壁纸，默认本地运行、隐私友好。",
  url: "https://startpage.local",
  author: "Startpage",
};

/** 约束常量（用于校验与 UI 限制） */
export const LIMITS = {
  shortcutTitleMax: 16,
  groupNameMax: 12,
  maxShortcuts: 200,
  maxGroups: 12,
  maxQuickCommands: 32,
  maxWhitelistHosts: 32,
  quoteTimeoutMs: 3000,
  suggestTimeoutMs: 2500,
  wallpaperTimeoutMs: 8000,
  /** 自定义壁纸体积上限（字节）：超过就不进 IndexedDB，避免撑爆配额 */
  wallpaperMaxBytes: 8 * 1024 * 1024,
} as const;
