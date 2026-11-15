import type { QuickCommand, ShortcutGroup } from "./site";

export type ThemeMode = "light" | "dark" | "system";
export type WallpaperSource = "none" | "url" | "local";

export type AppConfig = {
  version: 1;
  /** 首页形态：simple = 只有时间/搜索/Dock；classic = 保留便签、一言与顶栏 */
  home: {
    simple: boolean;
  };
  engineId: string;
  /** 引擎顺序（设置内可排序） */
  engineOrder: string[];
  quickCommands: QuickCommand[];
  groups: ShortcutGroup[];
  theme: {
    mode: ThemeMode;
    accent: string;
  };
  clock: {
    show: boolean;
    showSeconds: boolean;
  };
  greeting: {
    show: boolean;
    custom: string;
  };
  quote: {
    show: boolean;
    source: "local" | "remote";
    category: string;
  };
  /** 背景：Edge（Bing）每日壁纸 */
  background: {
    /** edge = 每日一图；none = 仅渐变兜底 */
    source: "edge" | "none";
    /** 往前回溯第几天（0 = 今天，最多 7） */
    offset: number;
    /** 暗化 0-100 */
    dim: number;
    /** 模糊 0-20px */
    blur: number;
    /** 四角压暗的暗角滤镜 */
    vignette: boolean;
    /** 缓慢缩放（Ken Burns） */
    kenBurns: boolean;
  };
  /** 自定义图片（可选叠加层，优先级高于每日壁纸） */
  wallpaper: {
    source: WallpaperSource;
    /** url/local: 图片地址或 dataURL */
    value: string;
  };
  suggest: {
    enabled: boolean;
  };
  icons: {
    /** 抓取站点自身 favicon（默认关闭，开启后需把站点域名加入白名单） */
    autoFetch: boolean;
  };
  /** 待办便签（PRD P2：最小形态，可关闭） */
  note: {
    enabled: boolean;
    content: string;
  };
  privacy: {
    /** 用户可编辑的请求白名单，与内置白名单合并使用 */
    whitelist: string[];
  };
  a11y: {
    reducedMotion: boolean | null; // null = 跟随系统
  };
};
