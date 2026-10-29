import type { QuickCommand, ShortcutGroup } from "./site";

export type ThemeMode = "light" | "dark" | "system";
export type WallpaperSource = "none" | "url" | "local";

export type AppConfig = {
  version: 1;
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
  weather: {
    enabled: boolean;
    unit: "c" | "f";
    /** 省级行政区名（如「浙江省」）；空串表示未选 */
    province: string;
    /** 城市名（如「杭州」）；空串表示未选 */
    city: string;
    /**
     * 查询用的最终坐标。
     *
     * 来源有三种，优先级从高到低：
     * 1. 用户手动选省 + 市 → 查内置坐标表写入（source = "manual"）
     * 2. 用户点「使用我的定位」→ 浏览器定位后反查最近城市回填（source = "geo"）
     * 3. 两者都没有 → 天气模块保持 idle，给出「选择城市 / 使用定位」入口
     * 不再让用户手填经纬度 —— 那是给开发者用的，不是给用户用的。
     */
    lat: number | null;
    lon: number | null;
    /** 坐标来源，仅用于界面提示，不参与逻辑判断 */
    source: "none" | "manual" | "geo";
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
