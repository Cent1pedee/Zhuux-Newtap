"use client";

import { useMemo } from "react";

/**
 * Magic UI · Border Beam
 * 沿矩形边框跑一圈的光点：用 offset-path 走 rect 路径，比纯 CSS 旋转更贴合圆角。
 * 只动 offset-distance 与 opacity，GPU 友好。
 */
export function BorderBeam({
  reduce = false,
  duration = 6,
  delay = 0,
  size = 90,
  className = "",
  colorFrom = "var(--accent)",
  colorTo = "transparent",
}: {
  reduce?: boolean;
  duration?: number;
  delay?: number;
  size?: number;
  className?: string;
  colorFrom?: string;
  colorTo?: string;
}) {
  const style = useMemo(
    () => ({
      width: size,
      height: 1.5,
      background: `linear-gradient(90deg, ${colorFrom}, ${colorTo})`,
      animationDuration: `${duration}s`,
      animationDelay: `${delay}s`,
    }),
    [size, colorFrom, colorTo, duration, delay],
  );

  if (reduce) return null;

  return (
    <span className={`border-beam pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <span className="border-beam-dot" style={style} />
    </span>
  );
}
