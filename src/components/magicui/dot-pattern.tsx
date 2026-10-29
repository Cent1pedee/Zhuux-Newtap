"use client";

/**
 * Magic UI · Dot Pattern
 *
 * SVG 点阵，圆点用 --accent 着色（不再用 currentColor，
 * 避免继承到浅色文字时几乎看不见），半径与不透明度都调高，
 * 边缘用径向遮罩淡出，中心叠一层辉光。
 */
export function DotPattern({ className = "", size = 24 }: { className?: string; size?: number }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <svg className="dot-pattern-svg size-full" width="100%" height="100%">
        <defs>
          <pattern id="sp-dot-pattern" width={size} height={size} patternUnits="userSpaceOnUse">
            <circle cx={size / 2} cy={size / 2} r="1.9" className="dot-pattern-dot" />
          </pattern>
          <radialGradient id="sp-dot-fade" cx="50%" cy="45%" r="68%">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="62%" stopColor="#fff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="sp-dot-mask">
            <rect width="100%" height="100%" fill="url(#sp-dot-fade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#sp-dot-pattern)" mask="url(#sp-dot-mask)" />
      </svg>
      <div className="dot-pattern-glow" />
    </div>
  );
}
