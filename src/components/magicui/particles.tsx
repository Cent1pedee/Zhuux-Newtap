"use client";

import { useEffect, useMemo, useRef } from "react";

/**
 * Magic UI · Floating 3D Particles
 *
 * 带景深的漂浮粒子：每颗粒子有独立的 z 轴深度（0.35~1），
 * 近处大而清晰、远处小而模糊，配合鼠标视差产生「三维空间」感。
 *
 * - 位置/尺寸/速度用固定 LCG 生成，服务端与客户端一致（避免 hydration 不匹配）
 * - 只动 transform 与 opacity，全部走 GPU 合成层
 * - 鼠标视差只改容器 transform，不做逐元素 JS 计算
 * - reduce 时整层不渲染（持续动画应完全关闭）
 */
export function Particles({
  count = 46,
  reduce = false,
  className = "",
}: {
  count?: number;
  reduce?: boolean;
  className?: string;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const dots = useMemo(() => {
    let seed = 20261027;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    return Array.from({ length: count }, (_, i) => {
      // z 越大越靠前：尺寸、亮度、模糊都随 z 变化
      const z = 0.35 + rand() * 0.65;
      return {
        id: i,
        left: rand() * 100,
        top: rand() * 100,
        z,
        size: 1.6 + z * 4.4,
        dur: 26 - z * 12 + rand() * 10,
        delay: -rand() * 26,
        drift: (rand() - 0.5) * (30 + z * 70),
        opacity: 0.3 + z * 0.5,
        blur: (1 - z) * 1.6,
      };
    });
  }, [count]);

  // 鼠标视差：整体按指针位置轻微位移，产生空间层次
  useEffect(() => {
    if (reduce) return;
    const stage = stageRef.current;
    if (!stage) return;
    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    const tick = () => {
      curX += (targetX - curX) * 0.06;
      curY += (targetY - curY) * 0.06;
      stage.style.transform = `translate3d(${(-curX * 14).toFixed(2)}px, ${(-curY * 10).toFixed(2)}px, 0)`;
      rafRef.current = window.requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [reduce]);

  if (reduce) return null;

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div className="particle-glow" />
      <div ref={stageRef} className="particle-stage">
        {dots.map((d) => (
          <span
            key={d.id}
            className="particle-dot"
            style={{
              left: `${d.left}%`,
              top: `${d.top}%`,
              width: d.size,
              height: d.size,
              opacity: d.opacity,
              filter: d.blur > 0.15 ? `blur(${d.blur.toFixed(2)}px)` : undefined,
              animationDuration: `${d.dur.toFixed(1)}s`,
              animationDelay: `${d.delay.toFixed(1)}s`,
              ["--drift" as string]: `${d.drift.toFixed(1)}px`,
              ["--depth" as string]: d.z.toFixed(2),
            }}
          />
        ))}
      </div>
    </div>
  );
}
