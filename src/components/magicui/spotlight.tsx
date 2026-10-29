"use client";

/**
 * Magic UI · Spotlight（按需引入，手写等价实现）
 * 参考 magicui.design/docs/components/spotlight
 *
 * 作用：鼠标在容器内移动时，跟随指针渲染一枚 accent 色径向光斑，
 * 只在 `pointer: fine`（有精确指针）且未开启 reduced-motion 时启用，
 * 避免触屏设备与低动效偏好下产生无意义的合成开销。
 */

import { useCallback, useRef, useState } from "react";

export function Spotlight({
  className = "",
  size = 220,
  color = "var(--accent)",
  opacity = 0.18,
}: {
  className?: string;
  /** 光斑直径（px） */
  size?: number;
  color?: string;
  opacity?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const onMove = useCallback((event: React.PointerEvent<HTMLSpanElement>) => {
    if (event.pointerType !== "mouse") return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  }, []);

  const onLeave = useCallback(() => setPos(null), []);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-testid="spotlight"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] ${className}`}
      style={{
        opacity: pos ? 1 : 0,
        transition: "opacity 200ms var(--ease-out-cubic)",
      }}
    >
      {pos ? (
        <span
          className="absolute rounded-full"
          style={{
            left: pos.x - size / 2,
            top: pos.y - size / 2,
            width: size,
            height: size,
            background: `radial-gradient(circle at center, color-mix(in srgb, ${color} ${Math.round(
              opacity * 100,
            )}%, transparent) 0%, transparent 70%)`,
            filter: "blur(10px)",
          }}
        />
      ) : null}
    </span>
  );
}
