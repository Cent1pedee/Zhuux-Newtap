"use client";

import { useMemo } from "react";

/**
 * Magic UI · Sparkles
 * 围绕某个容器的四角微光点，带错峰闪烁。reduce 时不渲染。
 */
export function Sparkles({
  count = 8,
  reduce = false,
  className = "",
  color = "var(--accent)",
}: {
  count?: number;
  reduce?: boolean;
  className?: string;
  color?: string;
}) {
  const items = useMemo(() => {
    let seed = 77771;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: rand() * 100,
      top: rand() * 100,
      size: 2 + rand() * 3,
      delay: -rand() * 6,
      dur: 2.4 + rand() * 3.2,
    }));
  }, [count]);

  if (reduce) return null;

  return (
    <span className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {items.map((s) => (
        <span
          key={s.id}
          className="sparkle-dot"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            background: color,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.dur}s`,
          }}
        />
      ))}
    </span>
  );
}
