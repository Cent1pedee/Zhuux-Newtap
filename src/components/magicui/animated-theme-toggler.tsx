"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Magic UI · Animated Theme Toggler
 *
 * 官方实现基于 next-themes + View Transitions API：点击时以按钮为圆心做
 * clip-path 圆形扩散，把新旧主题叠成一次过渡。本项目主题的唯一数据源是
 * ConfigProvider（支持亮 / 暗 / 跟随系统三态并持久化），因此这里保留同一套
 * 视觉与动画机制，但由外部传入当前明暗与切换回调，避免引入第二份主题状态。
 *
 * 不支持 startViewTransition 的浏览器（Firefox 稳定版、旧 Safari）自动退化为
 * 直接切换 —— 此时靠 CSS 变量上的 color/background 过渡兜底，仍然不闪白。
 */
type DocWithVT = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> };
};

export function useAnimatedThemeToggle() {
  const [animating, setAnimating] = useState(false);
  const originRef = useRef<{ x: number; y: number } | null>(null);

  const toggle = useCallback((isLight: boolean, apply: () => void, origin?: { x: number; y: number }) => {
    const doc = document as DocWithVT;
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 无 View Transitions 或用户要求减少动效：直接切换。
    // 不支持时给 <html> 挂 .theme-animating，让所有元素在 320ms 内平滑过渡颜色，
    // 避免出现「一半旧色一半新色」的跳变（样式见 globals.css）。
    if (typeof doc.startViewTransition !== "function" || reduce) {
      if (reduce) {
        apply();
        return;
      }
      const root = document.documentElement;
      root.classList.add("theme-animating");
      apply();
      window.setTimeout(() => root.classList.remove("theme-animating"), 360);
      return;
    }

    // 扩散圆心：优先用点击位置，其次用按钮中心，最后退回视口中心
    const rect = origin ?? originRef.current ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const x = rect.x;
    const y = rect.y;
    const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    const root = document.documentElement;
    root.style.setProperty("--vt-x", `${x}px`);
    root.style.setProperty("--vt-y", `${y}px`);
    root.style.setProperty("--vt-r", `${endRadius}px`);

    setAnimating(true);
    const transition = doc.startViewTransition(() => {
      // 同步写入 data-theme，让新快照就是目标主题
      apply();
    });

    void transition.ready
      .then(() => {
        // 新主题从圆心向外扩散（isLight → 变亮 / 反之变暗都用同一方向）
        const clip = [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`];
        root.animate(
          { clipPath: clip },
          {
            duration: 520,
            easing: "cubic-bezier(0.215, 0.61, 0.355, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => {
        /* 过渡被中断时不影响最终主题 */
      });

    void transition.finished
      .catch(() => undefined)
      .finally(() => setAnimating(false));
  }, []);

  return { toggle, animating };
}
