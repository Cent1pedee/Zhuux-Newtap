import { ACCENTS, LIMITS, type Shortcut } from "@/config/site";

export type ImportedBookmark = {
  title: string;
  url: string;
  /** 所在文件夹名，仅用于预览；Shortcut 模型本身没有分组 */
  folder: string;
};

export type BookmarkParseResult = {
  items: ImportedBookmark[];
  /** 文件里带 href 的 <a> 总数（含被过滤的） */
  total: number;
  /** 非 http(s)、空地址等 */
  invalid: number;
  /** 文件内部重复 */
  duplicates: number;
};

function dedupeKey(url: URL): string {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return `${url.hostname.toLowerCase()}${path}${url.search}`;
}

function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

/**
 * 取最近一层文件夹名。
 *
 * 书签文件写的是 `<DT><H3>文件夹</H3><DL>…`，但 HTML 解析器不会在 <DL> 处
 * 闭合 <DT>，实际 DOM 是 `<DT><H3>…</H3><DL>…</DL></DT>` —— 所以内层 DL 的
 * previousElementSibling 是 H3，而不是包着 H3 的 DT。两种结构都要认。
 */
function folderOf(anchor: Element): string {
  const dl = anchor.closest("dl");
  if (!dl) return "";
  const prev = dl.previousElementSibling;
  if (!prev) return "";
  const tag = prev.tagName.toLowerCase();
  const heading = tag === "h3" ? prev : tag === "dt" ? prev.querySelector("h3") : null;
  return (heading?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * 解析浏览器导出的书签 HTML（Netscape Bookmark File Format）。
 *
 * 用 DOMParser 而不是正则：导出文件里的标题常有 `&amp;`、`&#39;` 与嵌套文件夹，
 * 正则版本会在这些地方给出错误的标题。DOMParser 只在浏览器/jsdom 里有，
 * 服务端调用直接返回空结果（这个函数本来也只在文件选择后执行）。
 */
export function parseBookmarksHtml(html: string): BookmarkParseResult {
  const empty: BookmarkParseResult = { items: [], total: 0, invalid: 0, duplicates: 0 };
  if (typeof DOMParser === "undefined" || !html.trim()) return empty;

  const doc = new DOMParser().parseFromString(html, "text/html");
  const anchors = Array.from(doc.querySelectorAll("a[href]"));

  const items: ImportedBookmark[] = [];
  const seen = new Set<string>();
  let invalid = 0;
  let duplicates = 0;

  for (const anchor of anchors) {
    const href = (anchor.getAttribute("href") ?? "").trim();
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      invalid += 1;
      continue;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      invalid += 1;
      continue;
    }
    const key = dedupeKey(url);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    const title = (anchor.textContent ?? "").replace(/\s+/g, " ").trim() || url.hostname;
    items.push({ title, url: url.href, folder: folderOf(anchor) });
  }

  return { items, total: anchors.length, invalid, duplicates };
}

export type MapResult = {
  items: Shortcut[];
  /** 已存在、文件内重复、超出上限的总数 */
  skipped: number;
};

/**
 * 转成 Shortcut：按 URL 去重（与现有快捷项比对），遵守总上限，标题截到 16 字。
 * 图标统一用「自动 / 首字母」，颜色按 URL 哈希从主题色板里取，避免整排同色。
 */
export function toShortcuts(
  bookmarks: ImportedBookmark[],
  existing: Shortcut[],
  limit: number = LIMITS.maxShortcuts,
): MapResult {
  const seen = new Set<string>();
  for (const item of existing) {
    try {
      seen.add(dedupeKey(new URL(item.url)));
    } catch {
      seen.add(item.url);
    }
  }

  const items: Shortcut[] = [];
  let skipped = 0;

  for (const bookmark of bookmarks) {
    const key = dedupeKey(new URL(bookmark.url));
    if (seen.has(key) || existing.length + items.length >= limit) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    const hash = hashString(bookmark.url);
    items.push({
      id: `imp-${hash.toString(36)}-${items.length}`,
      title: bookmark.title.slice(0, LIMITS.shortcutTitleMax),
      url: bookmark.url,
      iconKind: "letter",
      iconValue: "",
      color: ACCENTS[hash % ACCENTS.length].value,
    });
  }

  return { items, skipped };
}
