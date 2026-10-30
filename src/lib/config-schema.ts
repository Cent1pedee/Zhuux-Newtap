/**
 * 配置合并与校验。
 *
 * 为什么单独成文件：`mergeConfig` 是唯一一处「外部数据进入应用」的闸门
 * （localStorage 读盘 + 导入 JSON 都走它），它需要的是一张字段表，
 * 而不是散落在 storage 里的 typeof 判断。放在这里，schema 与合并算法挨着，
 * 加字段时只改一处。
 *
 * 校验原则：
 *  1. 以出厂配置为骨架，逐字段按显式 schema 判断，**不使用 typeof 猜**；
 *  2. 默认值为 null 的可空字段（weather.lat / a11y.reducedMotion）单独声明期望类型
 *     —— 历史 bug：typeof null === "object"，让 `{"weather":{"lat":"x"}}` 也能写进去，
 *     随后 `lat.toFixed(3)` 直接抛错、整块天气白屏；
 *  3. 枚举值必须在白名单里 —— 否则 `theme.mode: "purple"` 会让 `data-theme` 变成
 *     不存在的主题，CSS 变量全部落空；
 *  4. 数值越界一律 clamp —— `blur: 9999` 能把整页糊成一片；
 *  5. 数组逐元素校验 + 丢弃坏元素 + 施加 LIMITS 上限 —— 整体替换等于把
 *     `{ id: undefined, url: undefined }` 直接送进 `window.open()`；
 *  6. 坏值回退默认值，绝不抛错：调用方是首屏渲染路径。
 */

import { LIMITS } from "@/config/site";
import type { QuickCommand, Shortcut, ShortcutGroup } from "@/config/site";
import type { AppConfig } from "@/config/types";

/* ------------------------------- schema ------------------------------- */

type Field =
  | { kind: "string"; max?: number }
  | { kind: "number"; min?: number; max?: number }
  | { kind: "boolean" }
  /** 可空数值：默认 null，但只接受 number 或 null */
  | { kind: "number|null"; min?: number; max?: number }
  /** 可空布尔：默认 null（跟随系统），只接受 boolean 或 null */
  | { kind: "boolean|null" }
  | { kind: "hexColor" }
  | { kind: "enum"; values: readonly string[] }
  | { kind: "stringArray"; max: number; maxLen?: number }
  | { kind: "quickCommands" }
  | { kind: "shortcutGroups" }
  | { kind: "object"; fields: Record<string, Field> };

const enumOf = (values: readonly string[]): Field => ({ kind: "enum", values });

const SCHEMA: Record<keyof AppConfig, Field> = {
  version: { kind: "number", min: 1, max: 1 },
  engineId: { kind: "string", max: 40 },
  engineOrder: { kind: "stringArray", max: 32, maxLen: 40 },
  quickCommands: { kind: "quickCommands" },
  groups: { kind: "shortcutGroups" },
  theme: {
    kind: "object",
    fields: {
      mode: enumOf(["light", "dark", "system"]),
      accent: { kind: "hexColor" },
    },
  },
  clock: {
    kind: "object",
    fields: {
      show: { kind: "boolean" },
      showSeconds: { kind: "boolean" },
    },
  },
  greeting: {
    kind: "object",
    fields: {
      show: { kind: "boolean" },
      custom: { kind: "string", max: 40 },
    },
  },
  quote: {
    kind: "object",
    fields: {
      show: { kind: "boolean" },
      source: enumOf(["local", "remote"]),
      category: { kind: "string", max: 20 },
    },
  },
  background: {
    kind: "object",
    fields: {
      source: enumOf(["edge", "none"]),
      // API 只支持 0-7，越界会让 index 参数失效
      offset: { kind: "number", min: 0, max: 7 },
      dim: { kind: "number", min: 0, max: 100 },
      blur: { kind: "number", min: 0, max: 20 },
      kenBurns: { kind: "boolean" },
    },
  },
  wallpaper: {
    kind: "object",
    fields: {
      source: enumOf(["none", "url", "local"]),
      /*
       * 本地图片是 dataURL，8MB 的二进制转 base64 约 11MB 字符。
       * 上限必须留够，否则「截断」会把图片悄悄截成坏图 —— 这比拒绝更难排查。
       * 12M 字符 ≈ 9MB 二进制，正好盖住 LIMITS.wallpaperMaxBytes。
       */
      value: { kind: "string", max: 12_000_000 },
    },
  },
  suggest: {
    kind: "object",
    fields: { enabled: { kind: "boolean" } },
  },
  weather: {
    kind: "object",
    fields: {
      enabled: { kind: "boolean" },
      unit: enumOf(["c", "f"]),
      province: { kind: "string", max: 40 },
      city: { kind: "string", max: 40 },
      lat: { kind: "number|null", min: -90, max: 90 },
      lon: { kind: "number|null", min: -180, max: 180 },
      source: enumOf(["none", "manual", "geo"]),
    },
  },
  icons: {
    kind: "object",
    fields: { autoFetch: { kind: "boolean" } },
  },
  note: {
    kind: "object",
    fields: {
      enabled: { kind: "boolean" },
      content: { kind: "string", max: 2000 },
    },
  },
  privacy: {
    kind: "object",
    fields: { whitelist: { kind: "stringArray", max: LIMITS.maxWhitelistHosts, maxLen: 253 } },
  },
  a11y: {
    kind: "object",
    fields: { reducedMotion: { kind: "boolean|null" } },
  },
};

/* ------------------------------ 元素校验 ------------------------------ */

function normalizeQuickCommand(raw: unknown): QuickCommand | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const key = typeof r.key === "string" ? r.key.trim() : "";
  const label = typeof r.label === "string" ? r.label.trim() : "";
  const url = typeof r.url === "string" ? r.url.trim() : "";
  const siteUrl = typeof r.siteUrl === "string" ? r.siteUrl.trim() : "";
  // 指令必须以 / 开头、必须有标签与站点地址，否则解析器与跳转都无从下手
  if (!id || !key.startsWith("/") || !label || !siteUrl) return null;
  if (!isHttpUrl(siteUrl)) return null;
  return {
    id: id.slice(0, 40),
    key: key.slice(0, 20),
    label: label.slice(0, 20),
    url: url && isHttpUrl(url) ? url : `${siteUrl}/search?q={q}`,
    siteUrl,
  };
}

function normalizeShortcut(raw: unknown): Shortcut | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const url = typeof r.url === "string" ? r.url.trim() : "";
  if (!title || !isHttpUrl(url)) return null;
  const iconKind =
    r.iconKind === "emoji" || r.iconKind === "image" || r.iconKind === "letter" ? r.iconKind : "letter";
  const iconValue = typeof r.iconValue === "string" ? r.iconValue.slice(0, 3_000_000) : "";
  const color = typeof r.color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(r.color) ? r.color : undefined;
  return {
    id: typeof r.id === "string" && r.id ? r.id.slice(0, 64) : `sc-${title}-${url}`.slice(0, 64),
    title: title.slice(0, LIMITS.shortcutTitleMax),
    url,
    iconKind,
    iconValue,
    ...(color ? { color } : {}),
  };
}

function normalizeGroup(raw: unknown, budget: number): ShortcutGroup | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" && r.id ? r.id.slice(0, 64) : "";
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!id || !name) return null;
  const items: Shortcut[] = [];
  if (Array.isArray(r.items)) {
    for (const item of r.items) {
      if (items.length >= budget) break;
      const next = normalizeShortcut(item);
      if (next) items.push(next);
    }
  }
  return { id, name: name.slice(0, LIMITS.groupNameMax), items };
}

/* ------------------------------- 工具 ------------------------------- */

function isHttpUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function clamp(n: number, min?: number, max?: number): number {
  let out = n;
  if (min !== undefined) out = Math.max(min, out);
  if (max !== undefined) out = Math.min(max, out);
  return out;
}

/** 逐字段校验：next 不合法就返回 current（出厂值） */
function pick(field: Field, current: unknown, next: unknown): unknown {
  if (next === undefined) return current;
  // 可空字段把 null 当合法值（「未选择」）；其余字段 null 一律视为没传
  const nullish = field.kind === "number|null" || field.kind === "boolean|null";
  if (next === null) return nullish ? null : current;

  switch (field.kind) {
    case "string": {
      if (typeof next !== "string") return current;
      return field.max ? next.slice(0, field.max) : next;
    }
    case "number": {
      if (typeof next !== "number" || !Number.isFinite(next)) return current;
      return clamp(next, field.min, field.max);
    }
    case "boolean":
      return typeof next === "boolean" ? next : current;
    case "number|null": {
      // 显式允许 null：这是「未选择」的合法表示
      if (next === null) return null;
      if (typeof next !== "number" || !Number.isFinite(next)) return current;
      return clamp(next, field.min, field.max);
    }
    case "boolean|null":
      return typeof next === "boolean" ? next : current;
    case "hexColor":
      return typeof next === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(next) ? next : current;
    case "enum":
      return typeof next === "string" && field.values.includes(next) ? next : current;
    case "stringArray": {
      if (!Array.isArray(next)) return current;
      const list = next
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .map((v) => (field.maxLen ? v.trim().slice(0, field.maxLen) : v.trim()))
        .slice(0, field.max);
      return list;
    }
    case "quickCommands": {
      if (!Array.isArray(next)) return current;
      const list: QuickCommand[] = [];
      for (const raw of next) {
        if (list.length >= LIMITS.maxQuickCommands) break;
        const cmd = normalizeQuickCommand(raw);
        if (cmd) list.push(cmd);
      }
      return list;
    }
    case "shortcutGroups": {
      if (!Array.isArray(next)) return current;
      const groups: ShortcutGroup[] = [];
      let budget = LIMITS.maxShortcuts;
      for (const raw of next) {
        if (groups.length >= LIMITS.maxGroups || budget <= 0) break;
        const group = normalizeGroup(raw, budget);
        if (!group) continue;
        budget -= group.items.length;
        groups.push(group);
      }
      return groups;
    }
    case "object": {
      if (typeof next !== "object" || Array.isArray(next)) return current;
      const out = { ...(current as Record<string, unknown>) };
      const patch = next as Record<string, unknown>;
      for (const [key, sub] of Object.entries(field.fields)) {
        // 不认识的子字段直接丢弃（patch 里多余键不会被带出去）
        if (!(key in patch)) continue;
        out[key] = pick(sub, out[key], patch[key]);
      }
      return out;
    }
    default:
      return current;
  }
}

/* ------------------------------- 对外 API ------------------------------- */

/**
 * 以默认配置为骨架合并外部配置。
 * 不修改传入的 base —— 用深拷贝开工，避免调用方持有的默认值被悄悄改写。
 */
export function mergeConfig(base: AppConfig, patch: unknown): AppConfig {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return base;

  const out = structuredCloneSafe(base) as unknown as Record<string, unknown>;
  const input = patch as Record<string, unknown>;

  for (const [key, field] of Object.entries(SCHEMA) as [keyof AppConfig, Field][]) {
    if (!(key in input)) continue;
    out[key] = pick(field, out[key], input[key]);
  }
  out.version = 1;
  return out as unknown as AppConfig;
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      /* 含不可克隆值（理论上不会出现）时退回 JSON 往返 */
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
