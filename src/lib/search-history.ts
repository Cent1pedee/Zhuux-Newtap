"use client";

/**
 * 搜索历史：单独一个 localStorage key，不写进 config。
 *
 * 放进 config 会让每敲一次回车就整份配置序列化 + 跨标签广播，
 * 而搜索历史是高频、低价值、可丢弃的数据，既不该占配置体积，
 * 也不该参与「导入 / 导出 / 恢复出厂」。
 */
export const SEARCH_HISTORY_KEY = "startpage.search-history.v1";
export const SEARCH_HISTORY_EVENT = "startpage:search-history";
export const SEARCH_HISTORY_LIMIT = 8;

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, SEARCH_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function write(items: string[]): string[] {
  if (typeof window === "undefined") return items;
  try {
    window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(items));
  } catch {
    // 隐私模式写不进去就算了，历史不是关键数据
  }
  window.dispatchEvent(new Event(SEARCH_HISTORY_EVENT));
  return items;
}

export function loadSearchHistory(): string[] {
  return read();
}

/** 新词放最前、去重、截断；指令（/ 开头）与空串不入库 */
export function pushSearchHistory(query: string): string[] {
  const value = query.trim();
  if (!value || value.startsWith("/")) return read();
  const next = [value, ...read().filter((item) => item !== value)].slice(0, SEARCH_HISTORY_LIMIT);
  return write(next);
}

export function removeSearchHistory(query: string): string[] {
  return write(read().filter((item) => item !== query));
}

export function clearSearchHistory(): string[] {
  return write([]);
}

export function subscribeSearchHistory(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SEARCH_HISTORY_EVENT, listener);
  return () => window.removeEventListener(SEARCH_HISTORY_EVENT, listener);
}
