"use client";

import { useEffect, useRef } from "react";

/**
 * Magic UI · Flickering Grid
 *
 * 方格矩阵，每格随机改变透明度形成「呼吸闪烁」。
 * 用 canvas 绘制：一屏上千个格子如果用 DOM，会带来上千个元素与上千条动画，
 * 主线程直接卡死；canvas 只画一次像素，开销恒定。
 *
 * - 颜色取 --accent，透明度基准 0.5（比早期版本更亮，保证在暗色/亮色下都能看清网格）
 * - 越靠中心越亮：用径向遮罩让边缘淡出，避免整屏噪点
 * - reduce 时画一帧静态网格，不再请求动画帧
 */
export function FlickeringGrid({
  className = "",
  size = 22,
  reduce = false,
}: {
  className?: string;
  size?: number;
  reduce?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cols = 0;
    let rows = 0;
    let dpr = 1;
    // 每格的闪烁状态：相位偏移 + 频率，用固定公式生成（无需随机种子表）
    let grid: number[] = [];

    const accent =
      getComputedStyle(canvas).getPropertyValue("--accent").trim() || "#2f6fed";

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      cols = Math.ceil(rect.width / size);
      rows = Math.ceil(rect.height / size);
      grid = new Array(cols * rows).fill(0).map((_, i) => {
        // 用坐标生成稳定的伪随机相位，刷新不会跳动
        const x = i % cols;
        const y = Math.floor(i / cols);
        return (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
      });
    };

    const draw = (time: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = accent;

      const cell = size * dpr;
      const cx = cols / 2;
      const cy = rows / 2;
      const maxDist = Math.hypot(cx, cy) || 1;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const phase = Math.abs(grid[i] ?? 0) * Math.PI * 2;
          // 0.7 基准 + 0.3 波动：始终可见，不会闪到完全透明
          const flicker = 0.7 + 0.3 * Math.sin(time * 0.0012 + phase);
          // 中心亮、边缘暗（衰减放缓，整屏都能看出网格，而不是只有中间一团）
          const dist = Math.hypot(x - cx, y - cy) / maxDist;
          const radial = Math.max(0.14, 1 - dist * 0.72);
          // 0.42 的整体强度：比早期「几乎看不见」亮得多，但不会盖过前景内容
          const alpha = flicker * radial * 0.42;
          if (alpha <= 0.03) continue;
          ctx.globalAlpha = alpha;
          // 留 1px 缝隙让网格线清晰
          ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2 * dpr, cell - 2 * dpr);
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (time: number) => {
      draw(time);
      rafRef.current = window.requestAnimationFrame(loop);
    };

    resize();
    if (reduce) {
      draw(0);
    } else {
      rafRef.current = window.requestAnimationFrame(loop);
    }

    const onResize = () => {
      resize();
      if (reduce) draw(0);
    };
    window.addEventListener("resize", onResize);

    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [size, reduce]);

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} className="size-full" data-testid="flickering-grid" />
      <div className="flickering-grid-glow" />
    </div>
  );
}
