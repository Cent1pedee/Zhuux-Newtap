/**
 * 存储封装（PRD 6.3：数据层）
 * - localStorage：用户配置（单一 key）
 * - IndexedDB：壁纸 / 图标二进制缓存
 * 全部函数对 SSR 与隐私模式（localStorage 抛错）做兜底，绝不抛出到渲染层。
 */

import { createDefaultConfig } from "@/config/defaults";
import type { AppConfig } from "@/config/types";

export const CONFIG_KEY = "startpage.config.v1";
const DB_NAME = "startpage";
const DB_VERSION = 1;
const STORE_IMAGES = "images";

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

/** 深度合并：以默认配置为骨架，忽略类型不符的字段（导入时的防御） */
export function mergeConfig(base: AppConfig, patch: unknown): AppConfig {
  if (!patch || typeof patch !== "object") return base;
  const p = patch as Record<string, unknown>;
  const out: AppConfig = structuredCloneSafe(base);
  for (const key of Object.keys(out) as (keyof AppConfig)[]) {
    if (!(key in p)) continue;
    const current = out[key];
    const next = p[key];
    if (next === null || next === undefined) continue;
    if (Array.isArray(current)) {
      if (Array.isArray(next)) {
        (out as unknown as Record<string, unknown>)[key] = next;
      }
      continue;
    }
    if (typeof current === "object") {
      if (typeof next === "object" && !Array.isArray(next)) {
        const merged = { ...(current as object) } as Record<string, unknown>;
        for (const sub of Object.keys(next as object)) {
          if (!(sub in merged)) continue; // 丢弃不认识的字段
          const subNext = (next as Record<string, unknown>)[sub];
          // 只在类型一致时覆盖，防止导入把 accent 写成数字导致渲染崩溃；
          // 默认值为 null 的可空字段（如 weather.lat）允许写入 number/string。
          const currentSub = merged[sub];
          const compatible =
            typeof subNext === typeof currentSub ||
            currentSub === null ||
            subNext === null;
          if (compatible) merged[sub] = subNext;
        }
        (out as unknown as Record<string, unknown>)[key] = merged;
      }
      continue;
    }
    if (typeof next === typeof current) {
      (out as unknown as Record<string, unknown>)[key] = next;
    }
  }
  out.version = 1;
  return out;
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      /* ignore */
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
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

function openDb(): Promise<IDBDatabase | null> {
  if (!isBrowser() || typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const done = (db: IDBDatabase | null) => {
      if (!settled) {
        settled = true;
        resolve(db);
      }
    };
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_IMAGES)) db.createObjectStore(STORE_IMAGES);
      };
      req.onsuccess = () => done(req.result);
      req.onerror = () => done(null);
      req.onblocked = () => done(null);
      // 隐私模式下 open 可能永久挂起，2s 后放弃
      window.setTimeout(() => done(null), 2000);
    } catch {
      done(null);
    }
  });
}

export async function cachePut(key: string, value: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_IMAGES, "readwrite");
      tx.objectStore(STORE_IMAGES).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

export async function cacheGet(key: string): Promise<string | null> {
  const db = await openDb();
  if (!db) return null;
  const result = await new Promise<string | null>((resolve) => {
    try {
      const tx = db.transaction(STORE_IMAGES, "readonly");
      const req = tx.objectStore(STORE_IMAGES).get(key);
      req.onsuccess = () => resolve(typeof req.result === "string" ? req.result : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  db.close();
  return result;
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
    } catch {
      resolve();
    }
  });
  db.close();
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
