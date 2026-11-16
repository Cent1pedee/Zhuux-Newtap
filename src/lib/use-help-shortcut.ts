"use client";

import { useEffect } from "react";

/**
 * 全局 `?` 快捷键：打开「快捷键说明」。
 *
 * 为什么从 `ShortcutHelp` 里搬出来：那个弹窗用到 Radix Dialog，而它原先常驻挂载，
 * 于是整套 UI kit 被拖进首屏 bundle。现在弹窗改为按需加载（见 page.tsx 的 dynamic），
 * 监听就得留在页面这一层 —— 否则组件不挂载，快捷键也就不存在了。
 *
 * 三条约束与原实现一致：
 *   · 输入框里问号是正文，不是快捷键（中文输入法下尤其常见）；
 *   · 带修饰键（⌘/Ctrl/Alt）不算，避免和浏览器/系统快捷键打架；
 *   · 已经打开时不再重复触发。
 */
export function useHelpShortcut(onOpen: () => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "?" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, [contenteditable='true']")) return;
      event.preventDefault();
      onOpen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpen, enabled]);
}
