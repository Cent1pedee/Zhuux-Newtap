import {
  ACCENTS,
  DEFAULT_ACCENT,
  DEFAULT_ENGINE_ID,
  DEFAULT_GROUPS,
  DEFAULT_WHITELIST,
  ENGINES,
  QUICK_COMMANDS,
  type Engine,
} from "./site";
import type { AppConfig } from "./types";

export const CONFIG_VERSION = 1 as const;

export function createDefaultConfig(): AppConfig {
  return {
    version: CONFIG_VERSION,
    engineId: DEFAULT_ENGINE_ID,
    engineOrder: ENGINES.map((e) => e.id),
    quickCommands: QUICK_COMMANDS.map((c) => ({ ...c })),
    groups: DEFAULT_GROUPS.map((g) => ({ ...g, items: g.items.map((i) => ({ ...i })) })),
    theme: { mode: "dark", accent: DEFAULT_ACCENT },
    clock: { show: true, showSeconds: false },
    greeting: { show: true, custom: "" },
    // 一言默认走远程 API（hitokoto），失败时自动回退本地 36 条语录
    quote: { show: true, source: "remote", category: "all" },
    background: {
      source: "edge",
      offset: 0,
      dim: 18,
      blur: 0,
      kenBurns: true,
    },
    wallpaper: { source: "none", value: "" },
    suggest: { enabled: false },
    // 天气默认开启，但坐标留空 —— 首屏看到的是「选择城市 / 使用定位」两个入口，
    // 选过一次就记住（localStorage），此后开箱即显示。
    weather: { enabled: true, unit: "c", province: "", city: "", lat: null, lon: null, source: "none" },
    // 站点 favicon 默认开启：Dock 与引擎徽标都靠它显示真实图标，
    // 关掉就全部退回首字母（见 site.ts 里关于白名单模型的说明）
    icons: { autoFetch: true },
    // 便签是「中段便当板」里唯一开箱可用的模块；默认开启，
    // 否则搜索框与一言之间会是一段空白，看不到那块板子
    note: { enabled: true, content: "" },
    privacy: { whitelist: [...DEFAULT_WHITELIST] },
    a11y: { reducedMotion: null },
  };
}

/** 引擎按用户排序返回 */
export function orderedEngines(config: AppConfig): Engine[] {
  const map = new Map(ENGINES.map((e) => [e.id, e]));
  const ordered: Engine[] = [];
  for (const id of config.engineOrder) {
    const e = map.get(id);
    if (e) ordered.push(e);
    map.delete(id);
  }
  // 兜底：新增但未进入排序表的引擎追加到末尾
  for (const e of map.values()) ordered.push(e);
  return ordered;
}

export function activeEngine(config: AppConfig): Engine {
  const list = orderedEngines(config);
  return list.find((e) => e.id === config.engineId) ?? list[0] ?? ENGINES[0];
}

export function accentList() {
  return ACCENTS;
}
