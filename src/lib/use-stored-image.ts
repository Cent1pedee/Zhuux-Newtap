"use client";

import { useEffect, useState } from "react";
import { getStoredImage, isStoredImageRef, peekStoredImage } from "@/lib/image-store";

/**
 * 把配置里的「图片字段」解析成可直接放进 <img src> 的字符串。
 *
 * 三种取值都要兼容：
 *   · `idb:...`      —— 新格式，图片在 IndexedDB，异步取（内存命中时同步返回）；
 *   · `data:image/…` —— 老配置的内联图，直接用（迁移在 ConfigProvider 启动时做）；
 *   · `http(s)://…`  —— 远程地址，直接用。
 *
 * 取不到时返回 null，调用方据此走各自的降级链（首字母 / 每日壁纸 / 渐变）。
 */
export function useStoredImage(value: string): string | null {
  const [resolved, setResolved] = useState<string | null>(() =>
    isStoredImageRef(value) ? peekStoredImage(value) : value || null,
  );

  useEffect(() => {
    if (!isStoredImageRef(value)) {
      setResolved(value || null);
      return;
    }
    const cached = peekStoredImage(value);
    if (cached) {
      setResolved(cached);
      return;
    }
    let alive = true;
    setResolved(null);
    void getStoredImage(value).then((src) => {
      if (alive) setResolved(src);
    });
    return () => {
      alive = false;
    };
  }, [value]);

  return resolved;
}
