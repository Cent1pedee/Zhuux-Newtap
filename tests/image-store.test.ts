import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultConfig } from "@/config/defaults";
import type { Shortcut, ShortcutGroup } from "@/config/site";

/**
 * 图片资源库的纯逻辑测试。
 *
 * 真实 IndexedDB 行为由浏览器兜底（jsdom 没有实现），这里用内存 Map 替身，
 * 只关心四件事：引用格式、内容去重、写入失败会不会冒泡、旧配置能不能迁移。
 */
const backing = new Map<string, string>();

const cacheMock = vi.hoisted(() => ({
  put: vi.fn(async (key: string, value: string) => {
    backing.set(key, value);
    return true;
  }),
  get: vi.fn(async (key: string) => backing.get(key) ?? null),
  del: vi.fn(async (key: string) => {
    backing.delete(key);
  }),
}));

vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return {
    ...actual,
    cachePut: cacheMock.put,
    cacheGet: cacheMock.get,
    cacheDelete: cacheMock.del,
  };
});

const {
  deleteStoredImage,
  getStoredImage,
  hasInlineImages,
  imageRefOf,
  isStoredImageRef,
  migrateInlineImages,
  peekStoredImage,
  putStoredImage,
} = await import("@/lib/image-store");

const PNG = `data:image/png;base64,${"A".repeat(2048)}`;

beforeEach(() => {
  backing.clear();
  cacheMock.put.mockClear();
  cacheMock.get.mockClear();
  cacheMock.del.mockClear();
});

describe("引用格式与去重", () => {
  it("写入后返回 idb: 引用，本体落在内容寻址的键上", async () => {
    const ref = await putStoredImage("wallpaper", PNG);

    expect(isStoredImageRef(ref)).toBe(true);
    expect(ref).toContain("img:wallpaper");
    expect(ref).toBe(imageRefOf("wallpaper", PNG));
    expect(ref).not.toContain("base64");
    expect(backing.get(ref.slice("idb:".length))).toBe(PNG);
  });

  it("同一张图重复写入只占一份（引用相同）", async () => {
    const first = await putStoredImage("icon", PNG);
    const second = await putStoredImage("icon", PNG);

    expect(second).toBe(first);
    expect(backing.size).toBe(1);
  });

  it("不同用途分开存（壁纸与图标互不覆盖）", async () => {
    const wallpaper = await putStoredImage("wallpaper", PNG);
    const icon = await putStoredImage("icon", PNG);

    expect(wallpaper).not.toBe(icon);
    expect(backing.size).toBe(2);
  });

  it("非图片数据直接拒绝", async () => {
    await expect(putStoredImage("icon", "https://example.com/a.png")).rejects.toThrow("图片数据无效");
  });

  it("写不进 IndexedDB 时抛错（调用方必须据此提示用户）", async () => {
    cacheMock.put.mockResolvedValueOnce(false);
    await expect(putStoredImage("wallpaper", PNG)).rejects.toThrow("IndexedDB");
  });
});

describe("读取与回收", () => {
  it("写入后可以同步命中内存缓存", async () => {
    const ref = await putStoredImage("icon", PNG);
    expect(peekStoredImage(ref)).toBe(PNG);
    expect(await getStoredImage(ref)).toBe(PNG);
  });

  it("删除后同步缓存与 IndexedDB 都被清掉", async () => {
    const ref = await putStoredImage("wallpaper", PNG);
    await deleteStoredImage(ref);

    expect(peekStoredImage(ref)).toBeNull();
    expect(await getStoredImage(ref)).toBeNull();
    expect(backing.size).toBe(0);
  });
});

describe("旧配置迁移", () => {
  it("默认配置里没有内联图，走同步快路径", () => {
    expect(hasInlineImages(createDefaultConfig())).toBe(false);
  });

  it("壁纸与图标里的 dataURL 都会被搬进 IndexedDB 并换成引用", async () => {
    const base = createDefaultConfig();
    const item: Shortcut = {
      id: "sc-img",
      title: "图床",
      url: "https://img.example.com",
      iconKind: "image",
      iconValue: PNG,
    };
    const group: ShortcutGroup = { id: "grp-main", name: "快捷跳转", items: [item] };
    const legacy = {
      ...base,
      wallpaper: { source: "local" as const, value: PNG },
      groups: [group],
    };

    expect(hasInlineImages(legacy)).toBe(true);
    const migrated = await migrateInlineImages(legacy);

    expect(migrated).not.toBeNull();
    expect(isStoredImageRef(migrated!.wallpaper.value)).toBe(true);
    expect(isStoredImageRef(migrated!.groups[0].items[0].iconValue)).toBe(true);
    // 原配置不被修改
    expect(legacy.wallpaper.value).toBe(PNG);
  });

  it("迁移是幂等的：第二次不再产生改动", async () => {
    const base = createDefaultConfig();
    const legacy = { ...base, wallpaper: { source: "local" as const, value: PNG } };
    const first = await migrateInlineImages(legacy);
    expect(first).not.toBeNull();
    await expect(migrateInlineImages(first!)).resolves.toBeNull();
  });

  it("存储不可用时保留原 dataURL，不丢用户数据", async () => {
    cacheMock.put.mockResolvedValue(false);
    const base = createDefaultConfig();
    const legacy = { ...base, wallpaper: { source: "local" as const, value: PNG } };

    await expect(migrateInlineImages(legacy)).resolves.toBeNull();
  });
});
