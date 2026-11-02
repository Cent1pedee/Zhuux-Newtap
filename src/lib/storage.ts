/**
 * 存储封装（PRD 6.3：数据层）
 * - localStorage：用户配置（单一 key）
 * - IndexedDB：壁纸 / 图标二进制缓存
 * 全部函数对 SSR 与隐私模式（localStorage 抛错）做兜底，绝不抛出到渲染层。
 *
 * 配置的字段级校验在 `config-schema.ts`（对外仍从这里导出 mergeConfig，
 * 老调用方不用改 import）。
 */

import { createDefaultConfig } from "@/config/defaults";
import type { AppConfig } from "@/config/types";
import { mergeConfig as mergeWithSchema } from "@/lib/config-schema";

export const CONFIG_KEY = "startpage.config.v1";
const DB_NAME = "startpage";
const DB_VERSION = 1;
const STORE_IMAGES = "images";

/**
 * 配置写盘失败时广播的事件。
 *
 * localStorage 在配额满、Safari 隐私模式、被策略禁用时都会让 `setItem` 抛错，
 * `saveConfig` 只能返回 false —— 但调用方（ConfigProvider）没有 UI 能力提醒用户。
 * 用一条全局事件把「写入失败」这件事交出去，由 ToastProvider 负责显示，
 * 这样数据层不必依赖任何 React 组件。
 */
export const PERSIST_ERROR_EVENT = "startpage:persist-error";

export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function safeStorage(): Storage | null {
  if (!isBrowser()) return null;
  try {
    const s = window.localStorage;
    const probe = "__sp_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/** 深度合并：以默认配置为骨架，逐字段校验（schema 见 config-schema.ts） */
export function mergeConfig(base: AppConfig, patch: unknown): AppConfig {
  return mergeWithSchema(base, patch);
}

export function loadConfig(): AppConfig {
  const defaults = createDefaultConfig();
  const storage = safeStorage();
  if (!storage) return defaults;
  try {
    const raw = storage.getItem(CONFIG_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as unknown;
    return mergeConfig(defaults, parsed);
  } catch {
    return defaults;
  }
}

export function saveConfig(config: AppConfig): boolean {
  const storage = safeStorage();
  if (!storage) return false;
  try {
    storage.setItem(CONFIG_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

export function clearConfig(): void {
  const storage = safeStorage();
  try {
    storage?.removeItem(CONFIG_KEY);
  } catch {
    /* ignore */
  }
}

/* ---------------------------- IndexedDB 图片缓存 ---------------------------- */

/** FNV-1a 32 位：只用来把长字符串压成稳定的短键，不做加密用途 */
function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * 内容寻址的缓存键：`<前缀>:<长度>:<内容哈希>`。
 *
 * 历史写法是 `wallpaper:${value}` —— value 是 dataURL 时键能到 10MB 级：
 * 每次渲染都要拼一次超长字符串，IndexedDB 也会把这个键原样存进去。
 * 现在键长固定，同一个内容仍然命同一个坑位（可去重）。
 */
export function contentCacheKey(prefix: string, value: string): string {
  return `${prefix}:${value.length}:${hashString(value)}`;
}

export function imageCacheKey(value: string): string {
  return contentCacheKey("wallpaper", value);
}

/**
 * 单例连接。
 *
 * 原来每次 `cachePut` / `cacheGet` 都 open + close 一次：一排 12 个快捷图标
 * 各自读一次图就是 12 次开库；更糟的是 2s 超时分支把 `settled` 置位后，
 * 迟到的 `onsuccess` 被直接丢弃 —— 那个连接永远不会被关掉。
 * 现在连接复用，并在 `onversionchange` 时主动关闭让位给新版本。
 */
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (!isBrowser() || typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  const attempt = new Promise<IDBDatabase | null>((resolve) => {
    let settled = false;
    const done = (db: IDBDatabase | null) => {
      if (settled) {
        // 超时之后才打开成功的连接必须在这里关掉，否则就是泄漏
        db?.close();
        return;
      }
      settled = true;
      resolve(db);
    };
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_IMAGES)) db.createObjectStore(STORE_IMAGES);
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        done(db);
      };
      req.onerror = () => done(null);
      req.onblocked = () => done(null);
      // 隐私模式下 open 可能永久挂起，2s 后放弃
      window.setTimeout(() => done(null), 2000);
    } catch {
      done(null);
    }
  }).then((db) => {
    // 拿不到就允许下次重试，别把失败结果缓存一辈子
    if (!db) dbPromise = null;
    return db;
  });

  dbPromise = attempt;
  return attempt;
}

/** 写缓存。返回是否真的写进去了 —— 调用方需要据此提示用户，不能静默失败 */
export async function cachePut(key: string, value: string): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(STORE_IMAGES, "readwrite");
      tx.objectStore(STORE_IMAGES).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function cacheGet(key: string): Promise<string | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise<string | null>((resolve) => {
    try {
      const tx = db.transaction(STORE_IMAGES, "readonly");
      const req = tx.objectStore(STORE_IMAGES).get(key);
      req.onsuccess = () => resolve(typeof req.result === "string" ? req.result : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function cacheDelete(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_IMAGES, "readwrite");
      tx.objectStore(STORE_IMAGES).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function cacheClear(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_IMAGES, "readwrite");
      tx.objectStore(STORE_IMAGES).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** 一键清除全部本地数据（PRD 9.3） */
export async function clearAllData(): Promise<void> {
  clearConfig();
  await cacheClear();
  const storage = safeStorage();
  try {
    storage?.removeItem("startpage.wallpaper.daily");
  } catch {
    /* ignore */
  }
}
