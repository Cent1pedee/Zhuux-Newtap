/**
 * 图片资源库：图片本体存 IndexedDB，配置里只留引用。
 *
 * 为什么必须挪走
 * -------------
 * 壁纸与快捷图标的 dataURL 原来直接写进 config，再整份 JSON.stringify 存 localStorage。
 * 8MB 的图转 base64 约 11M 字符，而 localStorage 整站配额通常只有 5MB —— 写入抛
 * QuotaExceeded，`saveConfig` 返回 false：界面上图片已经换了，刷新后又回去，
 * 甚至整份配置回滚到上一次成功写入的状态。把上限压到 3MB 只是把「必现」变成「偶现」。
 *
 * 现在的分工
 * ----------
 *   · IndexedDB（`startpage` / `images`）：存 dataURL 本体，配额按磁盘算，几百 MB 级；
 *   · config：只留 `idb:img:wallpaper:<长度>:<内容哈希>` 这样几十字节的引用；
 *   · 引用是内容寻址的 —— 同一张图重复上传只占一份，换图即惰性去重。
 *
 * 为什么不在删除快捷项时顺手清理
 * ------------------------------
 * 引用是内容寻址的，两张快捷项完全可能指向同一张图（同一张 emoji 图上传两次），
 * 删一个就把另一个的图删掉。孤儿条目由「一键清除全部数据」统一回收，
 * 壁纸这种「同一时刻只有一个引用」的字段才做即时回收（见 controller.ts）。
 */

import type { Shortcut, ShortcutGroup } from "@/config/site";
import type { AppConfig } from "@/config/types";
import { cacheDelete, cacheGet, cachePut, contentCacheKey } from "@/lib/storage";

/** 引用前缀。带前缀是为了和普通的 http(s) 地址、历史 dataURL 明确区分开 */
export const IMAGE_REF_PREFIX = "idb:";

export type StoredImageKind = "wallpaper" | "icon";

/** 进程内的同步缓存：同一页里重复渲染图标时不必每次都等 IndexedDB */
const memory = new Map<string, string>();

export function isStoredImageRef(value: string): boolean {
  return value.startsWith(IMAGE_REF_PREFIX);
}

function cacheKeyOf(ref: string): string {
  return ref.slice(IMAGE_REF_PREFIX.length);
}

export function imageRefOf(kind: StoredImageKind, dataUrl: string): string {
  return `${IMAGE_REF_PREFIX}${contentCacheKey(`img:${kind}`, dataUrl)}`;
}

/**
 * 写入一张图，返回可放进配置的引用。
 * 写不进去（隐私模式、配额满）**抛错**——调用方必须据此提示用户，
 * 绝不能再出现「提示已保存、其实没存」。
 */
export async function putStoredImage(kind: StoredImageKind, dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) throw new Error("图片数据无效");
  const ref = imageRefOf(kind, dataUrl);
  const ok = await cachePut(cacheKeyOf(ref), dataUrl);
  if (!ok) throw new Error("图片写入 IndexedDB 失败");
  memory.set(ref, dataUrl);
  return ref;
}

/** 同步读取已知引用（命中内存缓存时不需要 await） */
export function peekStoredImage(ref: string): string | null {
  return memory.get(ref) ?? null;
}

export async function getStoredImage(ref: string): Promise<string | null> {
  const hit = memory.get(ref);
  if (hit) return hit;
  const value = await cacheGet(cacheKeyOf(ref));
  if (value) memory.set(ref, value);
  return value;
}

/** 移除一个引用对应的图（仅用于「确定只有一个引用」的字段，例如壁纸） */
export async function deleteStoredImage(ref: string): Promise<void> {
  memory.delete(ref);
  await cacheDelete(cacheKeyOf(ref));
}

/**
 * 配置里是否还躺着内联 dataURL。
 *
 * 单独抽出来是为了让启动路径保持同步：99% 的启动没有内联图，
 * 不该为了「可能迁移」白白多等一个微任务（现有用例与首帧时序都依赖同步 setState）。
 */
export function hasInlineImages(config: AppConfig): boolean {
  // 不区分 source：早期「把 dataURL 粘进图片地址」也会写成 source: "url" + dataURL
  if (config.wallpaper.value.startsWith("data:image/")) return true;
  return config.groups.some((group) =>
    group.items.some((item) => item.iconKind === "image" && item.iconValue.startsWith("data:image/")),
  );
}

/**
 * 把旧配置里的内联 dataURL 迁移成引用。
 *
 * 老版本的配置里可能躺着 5MB 级的 dataURL —— 那份配置本身早就写不回去了。
 * 读到这种配置时先搬进 IndexedDB、把字段换成引用再交给状态，用户无感修复。
 * 存储不可用时逐项放弃，原值保留（至少当前会话还能显示）。
 *
 * @returns 有改动时返回新配置，无需迁移时返回 null
 */
export async function migrateInlineImages(config: AppConfig): Promise<AppConfig | null> {
  if (!hasInlineImages(config)) return null;

  let next = config;
  let changed = false;

  if (next.wallpaper.source === "local" && next.wallpaper.value.startsWith("data:image/")) {
    try {
      const ref = await putStoredImage("wallpaper", next.wallpaper.value);
      next = { ...next, wallpaper: { ...next.wallpaper, value: ref } };
      changed = true;
    } catch {
      /* 存储不可用：保留 dataURL */
    }
  }

  const groups: ShortcutGroup[] = [];
  let iconsChanged = false;
  for (const group of next.groups) {
    let itemsChanged = false;
    const items: Shortcut[] = [];
    for (const item of group.items) {
      if (item.iconKind !== "image" || !item.iconValue.startsWith("data:image/")) {
        items.push(item);
        continue;
      }
      try {
        const ref = await putStoredImage("icon", item.iconValue);
        items.push({ ...item, iconValue: ref });
        itemsChanged = true;
      } catch {
        items.push(item);
      }
    }
    groups.push(itemsChanged ? { ...group, items } : group);
    iconsChanged = iconsChanged || itemsChanged;
  }

  if (iconsChanged) next = { ...next, groups };
  return changed || iconsChanged ? next : null;
}
