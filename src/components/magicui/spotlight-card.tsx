"use client";

import { useRef, useState } from "react";

/**
 * Magic UI · Spotlight Card
 * 卡片内跟随指针的柔光。指针离开后光斑淡出（opacity 过渡），不做持续动画。
 */
export function SpotlightCard({
  children,
  className = "",
  reduce = false,
  size = 260,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  reduce?: boolean;
  size?: number;
  as?: "div" | "section";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const Tag = as;

  return (
    <Tag
      ref={ref as never}
      className={`spotlight-card relative isolate overflow-hidden ${className}`}
      onPointerMove={(e: React.PointerEvent) => {
        if (reduce || e.pointerType !== "mouse" || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onPointerLeave={() => setPos(null)}
    >
      {pos && !reduce ? (
        <span
          className="spotlight-card-glow"
          aria-hidden="true"
          style={{
            width: size,
            height: size,
            left: pos.x - size / 2,
            top: pos.y - size / 2,
          }}
        />
      ) : null}
      {/* 内容层撑满容器：否则子元素上的 h-full 会相对一个 auto 高度的 span 计算而塌陷 */}
      <span className="relative z-10 flex h-full w-full flex-col">{children}</span>
    </Tag>
  );
}
